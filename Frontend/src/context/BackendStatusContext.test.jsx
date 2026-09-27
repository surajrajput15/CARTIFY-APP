import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { BackendStatusProvider, useBackendStatus } from './BackendStatusContext';

vi.mock('../config', () => ({ API_ORIGIN: 'https://api.example.com' }));

const Harness = () => {
  const { isOffline, isRecovering, reportNetworkError, reportNetworkSuccess, retry } = useBackendStatus();
  return (
    <div>
      <span data-testid="offline">{String(isOffline)}</span>
      <span data-testid="recovering">{String(isRecovering)}</span>
      <button onClick={reportNetworkError}>fail</button>
      <button onClick={reportNetworkSuccess}>ok</button>
      <button onClick={retry}>retry</button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <BackendStatusProvider>
      <Harness />
    </BackendStatusProvider>
  );

const offline = () => screen.getByTestId('offline').textContent;
const recovering = () => screen.getByTestId('recovering').textContent;

describe('BackendStatusProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // The reported symptom was a banner that vanished on its own and came back.
  // It auto-cleared after 8s of silence, so silence — not the server — decided
  // when the outage was over.
  it('does not auto-clear after 8s of silence', async () => {
    renderProvider();
    act(() => {
      screen.getByRole('button', { name: 'fail' }).click();
      screen.getByRole('button', { name: 'fail' }).click();
    });
    expect(offline()).toBe('true');

    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(offline()).toBe('true');
  });

  it('stays offline after a minute of silence with a failing probe', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    renderProvider();
    act(() => {
      screen.getByRole('button', { name: 'fail' }).click();
      screen.getByRole('button', { name: 'fail' }).click();
    });
    expect(offline()).toBe('true');

    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(offline()).toBe('true');
  });

  it('ignores a single isolated failure', async () => {
    renderProvider();
    act(() => { screen.getByRole('button', { name: 'fail' }).click(); });
    expect(offline()).toBe('false');
  });

  it('flags the outage after consecutive failures', () => {
    renderProvider();
    act(() => {
      screen.getByRole('button', { name: 'fail' }).click();
      screen.getByRole('button', { name: 'fail' }).click();
    });
    expect(offline()).toBe('true');
    // We have not reached the server at all yet, so this is not "recovering".
    expect(recovering()).toBe('false');
  });

  it('clears the outage when a real request succeeds', () => {
    renderProvider();
    act(() => {
      screen.getByRole('button', { name: 'fail' }).click();
      screen.getByRole('button', { name: 'fail' }).click();
    });
    expect(offline()).toBe('true');

    act(() => { screen.getByRole('button', { name: 'ok' }).click(); });
    expect(offline()).toBe('false');
    expect(recovering()).toBe('false');
  });

  it('recovers automatically once /ready answers 200', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200 });
    renderProvider();
    act(() => {
      screen.getByRole('button', { name: 'fail' }).click();
      screen.getByRole('button', { name: 'fail' }).click();
    });
    expect(offline()).toBe('true');

    // First probe fires after the initial 2s backoff.
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    await waitFor(() => expect(offline()).toBe('false'));
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/ready',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('keeps probing with backoff while unreachable', async () => {
    global.fetch.mockRejectedValue(new Error('Failed to fetch'));
    renderProvider();
    act(() => {
      screen.getByRole('button', { name: 'fail' }).click();
      screen.getByRole('button', { name: 'fail' }).click();
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(10100); });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(offline()).toBe('true');
  });

  it('treats a reachable but not-ready backend as still recovering, not recovered', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    renderProvider();
    act(() => {
      screen.getByRole('button', { name: 'fail' }).click();
      screen.getByRole('button', { name: 'fail' }).click();
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // /ready answered, so the server is up — but not confirmed recovered until
    // it reports 200, and the banner keeps telling the user we're reconnecting.
    expect(offline()).toBe('true');
    expect(recovering()).toBe('true');
  });

  it('does not probe while the backend is healthy', async () => {
    renderProvider();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stops probing after unmount', async () => {
    global.fetch.mockRejectedValue(new Error('Failed to fetch'));
    const { unmount } = renderProvider();
    act(() => {
      screen.getByRole('button', { name: 'fail' }).click();
      screen.getByRole('button', { name: 'fail' }).click();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    const callsBeforeUnmount = global.fetch.mock.calls.length;

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(global.fetch.mock.calls.length).toBe(callsBeforeUnmount);
  });
});

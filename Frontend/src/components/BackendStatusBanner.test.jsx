import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BackendStatusProvider, useBackendStatus } from '../context/BackendStatusContext';
import BackendStatusBanner from './BackendStatusBanner';
import { getBackendAdvice } from '../utils/backendStatusMessage';

vi.mock('../config', () => ({ API_ORIGIN: 'https://api.example.com' }));

const Fail = ({ count = 2 }) => {
  const { reportNetworkError } = useBackendStatus();
  return (
    <button onClick={() => { for (let i = 0; i < count; i += 1) reportNetworkError(); }}>
      fail
    </button>
  );
};

const Recover = () => {
  const { reportNetworkSuccess } = useBackendStatus();
  return <button onClick={reportNetworkSuccess}>recover</button>;
};

const renderBanner = (ui) =>
  render(
    <BackendStatusProvider>
      {ui}
      <BackendStatusBanner />
    </BackendStatusProvider>
  );

describe('BackendStatusBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stays hidden on a single failed request', () => {
    renderBanner(<Fail count={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    expect(screen.queryByText(/backend unavailable/i)).not.toBeInTheDocument();
  });

  it('warns about an unreachable API once failures accumulate', () => {
    renderBanner(<Fail count={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    expect(screen.getByText(/backend unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/can't reach the API at/i)).toBeInTheDocument();
  });

  // The banner used to tell production users to run a local dev server.
  it('warns production users to wait instead of starting a local backend', () => {
    expect(getBackendAdvice(true)).toMatch(/reconnect automatically/i);
    expect(getBackendAdvice(true)).not.toMatch(/npm run dev/i);
    expect(getBackendAdvice(true)).not.toMatch(/cd Backend/i);
  });

  it('tells developers to start the local backend in development', () => {
    expect(getBackendAdvice(false)).toMatch(/npm run dev/i);
  });

  it('renders the development guidance when the app is not a production build', () => {
    renderBanner(<Fail count={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    expect(screen.getByText(/npm run dev/i)).toBeInTheDocument();
  });

  // F-27: prod users must never see the API URL or dev-server instructions.
  it('hides the API URL and dev instructions in production', () => {
    render(
      <BackendStatusProvider>
        <Fail count={2} />
        <BackendStatusBanner prodBuild />
      </BackendStatusProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    expect(screen.getByText(/can't reach Cartify right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/can't reach the API at/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/localhost:5000/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/npm run dev/i)).not.toBeInTheDocument();
    expect(screen.getByText(/reconnect automatically/i)).toBeInTheDocument();
  });

  it('keeps a dismissed banner hidden for the same outage', async () => {
    renderBanner(<Fail count={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    expect(screen.queryByText(/backend unavailable/i)).not.toBeInTheDocument();

    // More failures in the same outage must not resurrect it.
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.queryByText(/backend unavailable/i)).not.toBeInTheDocument();
  });

  it('shows the banner again for a new outage after recovery', async () => {
    renderBanner(
      <>
        <Fail count={2} />
        <Recover />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    expect(screen.queryByText(/backend unavailable/i)).not.toBeInTheDocument();

    // Backend answers again...
    fireEvent.click(screen.getByRole('button', { name: 'recover' }));
    expect(screen.queryByText(/backend unavailable/i)).not.toBeInTheDocument();

    // ...then drops off a second time. The old dismissal must not hide this one.
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    expect(screen.getByText(/backend unavailable/i)).toBeInTheDocument();
  });

  it('hides itself once the backend answers', () => {
    renderBanner(
      <>
        <Fail count={2} />
        <Recover />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    expect(screen.getByText(/backend unavailable/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'recover' }));
    expect(screen.queryByText(/backend unavailable/i)).not.toBeInTheDocument();
  });

  it('retry triggers a fresh probe instead of its own request', async () => {
    global.fetch.mockRejectedValue(new Error('Failed to fetch'));
    renderBanner(<Fail count={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'fail' }));
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /retry connection/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/ready',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});

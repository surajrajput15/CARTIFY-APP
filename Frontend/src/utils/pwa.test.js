import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const load = async () => await import('./pwa');

describe('PWA helpers', () => {
  beforeEach(async () => {
    vi.resetModules();
    delete window.matchMedia;
    delete window.navigator.standalone;
    window.beforeinstallprompt = undefined;
  });

  afterEach(() => {
    delete window.matchMedia;
    delete window.navigator.standalone;
    delete window.beforeinstallprompt;
  });

  it('does not throw when registering in a browser without service workers', async () => {
    const { registerServiceWorker } = await load();
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it('reports no install prompt when none has fired', async () => {
    const { listenForInstallPrompt, canInstall } = await load();
    listenForInstallPrompt();
    expect(canInstall()).toBe(false);
  });

  it('captures the beforeinstallprompt event', async () => {
    const { listenForInstallPrompt, canInstall } = await load();
    listenForInstallPrompt();
    expect(canInstall()).toBe(false);

    const event = new Event('beforeinstallprompt');
    window.dispatchEvent(event);
    expect(canInstall()).toBe(true);
  });

  it('notifies subscribers when a prompt becomes available and clears on appinstalled', async () => {
    const { listenForInstallPrompt, subscribeCanInstall } = await load();
    listenForInstallPrompt();
    const states = [];
    const unsubscribe = subscribeCanInstall((value) => states.push(value));

    window.dispatchEvent(new Event('beforeinstallprompt'));
    expect(states).toEqual([true]);

    window.dispatchEvent(new Event('appinstalled'));
    expect(states).toEqual([true, false]);

    unsubscribe();
  });

  it('promptInstall returns false when no prompt is pending', async () => {
    const { listenForInstallPrompt, promptInstall } = await load();
    listenForInstallPrompt();
    expect(await promptInstall()).toBe(false);
  });

  it('promptInstall resolves accepted when the user accepts', async () => {
    const { listenForInstallPrompt, promptInstall, canInstall } = await load();
    listenForInstallPrompt();

    const event = new Event('beforeinstallprompt');
    event.prompt = () => {};
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);

    expect(await promptInstall()).toBe(true);
    expect(canInstall()).toBe(false);
  });

  it('isStandalone respects display-mode media query', async () => {
    const { isStandalone } = await load();
    window.matchMedia = () => ({ matches: false });
    expect(isStandalone()).toBe(false);

    window.matchMedia = () => ({ matches: true });
    expect(isStandalone()).toBe(true);
  });

  it('isStandalone returns false when no media query exists', async () => {
    const { isStandalone } = await load();
    expect(isStandalone()).toBe(false);
  });
});
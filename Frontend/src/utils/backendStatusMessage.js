// Wording for the backend-unreachable banner, kept out of the component file
// so it can be unit-tested directly (and so the component module only exports
// components, which keeps React Fast Refresh working).
//
// Regression: production users were told to run `cd Backend && npm run dev`,
// which is meaningless advice on a hosted Render service.
export const getBackendAdvice = (isProd) =>
  isProd
    ? 'It may be restarting or waking up. This page will reconnect automatically — no need to reload.'
    : 'Start the backend server (cd Backend && npm run dev) and try again.';

export const getBackendHeadline = (isRecovering) =>
  (isRecovering ? 'Reconnecting to the backend…' : 'Backend unavailable');

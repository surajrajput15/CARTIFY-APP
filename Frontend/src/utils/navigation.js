// Lightweight navigation bridge so non-component modules (e.g. the axios
// interceptor) can trigger client-side redirects without a full page reload.
// The App registers its `navigate` from React Router here; nothing happens
// until then (graceful degradation: the fallback is a location change).
let navigateFn = null;

export const registerNavigator = (fn) => {
  navigateFn = fn;
};

export const navigateToLogin = () => {
  if (navigateFn) {
    navigateFn('/login');
  } else if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};
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

// F-14: record where the user was so LoginPage can return them there after
// re-auth (LoginPage reads and clears sessionStorage 'redirectAfterLogin').
// Paths already on /login are skipped — there is nowhere to return to.
export const saveLoginRedirect = (path) => {
  if (path && !path.startsWith('/login')) {
    sessionStorage.setItem('redirectAfterLogin', path);
  }
};
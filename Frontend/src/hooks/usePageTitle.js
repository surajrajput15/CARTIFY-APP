import { useEffect } from 'react';

// Route-level document titles: "Cartify | Home", "Cartify | Checkout", etc.
// Every page calls this once; the title re-renders whenever `title` changes
// (e.g. a product finishing its load). Falsy titles fall back to the bare
// brand so no route is ever left with the default index.html title.
export const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `Cartify | ${title}` : 'Cartify';
  }, [title]);
};

export default usePageTitle;

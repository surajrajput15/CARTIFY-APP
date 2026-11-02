import { useEffect } from 'react';

/**
 * useSeo
 * Dynamic SEO, AEO, and Social Meta Tag Manager for Cartify SPA routes.
 *
 * @param {Object} options
 * @param {string} [options.title] - Page title (e.g. "About the Creator", "Help & FAQs")
 * @param {string} [options.description] - Meta description
 * @param {string} [options.canonical] - Full canonical URL or relative path
 * @param {string} [options.image] - Open Graph / Twitter image URL
 * @param {string} [options.type] - og:type (default "website")
 * @param {Object|Array} [options.schema] - Custom JSON-LD schema to inject into head
 */
export const useSeo = ({
  title,
  description,
  canonical,
  image,
  type = 'website',
  schema,
} = {}) => {
  // Use a stringified schema dependency to prevent infinite re-renders on object literals
  const schemaSerialized = schema ? JSON.stringify(schema) : null;

  useEffect(() => {
    if (title) {
      document.title = `Cartify | ${title}`;
    } else if (title === '') {
      document.title = 'Cartify';
    }

    const setMetaTag = (attribute, name, content) => {
      if (content === undefined || content === null) return;
      let el = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attribute, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
    const prevOgDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
    const prevTwitterDesc = document.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
    const prevOgTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const prevTwitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
    const prevCanonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    const prevOgUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content');
    const prevOgImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    const prevTwitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
    const prevOgType = document.querySelector('meta[property="og:type"]')?.getAttribute('content');

    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }

    if (title) {
      const fullTitle = `Cartify | ${title}`;
      setMetaTag('property', 'og:title', fullTitle);
      setMetaTag('name', 'twitter:title', fullTitle);
    }

    if (canonical) {
      const fullCanonical = canonical.startsWith('http')
        ? canonical
        : `https://cartify-hub.vercel.app${canonical.startsWith('/') ? canonical : `/${canonical}`}`;

      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', fullCanonical);
      setMetaTag('property', 'og:url', fullCanonical);
    }

    if (image) {
      setMetaTag('property', 'og:image', image);
      setMetaTag('name', 'twitter:image', image);
    }

    if (type) {
      setMetaTag('property', 'og:type', type);
    }

    let schemaScript = null;
    if (schemaSerialized) {
      schemaScript = document.createElement('script');
      schemaScript.setAttribute('type', 'application/ld+json');
      schemaScript.setAttribute('data-dynamic-seo', 'true');
      schemaScript.textContent = schemaSerialized;
      document.head.appendChild(schemaScript);
    }

    return () => {
      if (schemaScript && schemaScript.parentNode) {
        schemaScript.parentNode.removeChild(schemaScript);
      }
      if (description && prevDesc !== undefined) setMetaTag('name', 'description', prevDesc);
      if (description && prevOgDesc !== undefined) setMetaTag('property', 'og:description', prevOgDesc);
      if (description && prevTwitterDesc !== undefined) setMetaTag('name', 'twitter:description', prevTwitterDesc);
      if (title && prevOgTitle !== undefined) setMetaTag('property', 'og:title', prevOgTitle);
      if (title && prevTwitterTitle !== undefined) setMetaTag('name', 'twitter:title', prevTwitterTitle);
      if (canonical && prevCanonical !== undefined) {
        const link = document.querySelector('link[rel="canonical"]');
        if (link) link.setAttribute('href', prevCanonical);
        setMetaTag('property', 'og:url', prevOgUrl);
      }
      if (image && prevOgImage !== undefined) setMetaTag('property', 'og:image', prevOgImage);
      if (image && prevTwitterImage !== undefined) setMetaTag('name', 'twitter:image', prevTwitterImage);
      if (type && prevOgType !== undefined) setMetaTag('property', 'og:type', prevOgType);
    };
  }, [title, description, canonical, image, type, schemaSerialized]);
};

export default useSeo;

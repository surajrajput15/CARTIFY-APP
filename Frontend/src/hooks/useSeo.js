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
    const prevTitle = document.title;
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
    };
  }, [title, description, canonical, image, type, schemaSerialized]);
};

export default useSeo;

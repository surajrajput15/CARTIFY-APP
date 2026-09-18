import { API_URL } from '../config';

// Cloudinary optimization parameters
// f_auto: serve best format (WebP/AVIF) for the browser
// q_auto: automatic quality optimization
const CLOUDINARY_DEFAULTS = 'f_auto,q_auto';

// Base64 fallback placeholder shown when image fails to load
const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWNhM2FmIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

export function resolveImageUrl(src, fallback = PLACEHOLDER_IMG) {
  if (!src) return fallback;

  // Local upload paths
  if (src.startsWith('/uploads/')) {
    return `${API_URL}${src}`;
  }

  // Cloudinary URLs - apply optimization
  if (src.includes('res.cloudinary.com')) {
    // Insert transformation params after /upload/
    if (src.includes('/image/upload/') && !src.includes('/image/upload/' + CLOUDINARY_DEFAULTS)) {
      return src.replace('/image/upload/', `/image/upload/${CLOUDINARY_DEFAULTS}/`);
    }
    return src;
  }

  return src;
}

// Generate srcset for responsive images (Cloudinary only)
export function generateSrcSet(src, widths = [320, 640, 960, 1280]) {
  if (!src || !src.includes('res.cloudinary.com') || !src.includes('/image/upload/')) {
    return undefined;
  }

  return widths
    .map((w) => {
      const url = src.replace('/image/upload/', `/image/upload/${CLOUDINARY_DEFAULTS},w_${w}/`);
      return `${url} ${w}w`;
    })
    .join(', ');
}

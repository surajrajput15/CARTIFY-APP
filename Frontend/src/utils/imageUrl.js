import { API_URL } from '../config';

// Cloudinary optimization parameters
// f_auto: serve best format (WebP/AVIF) for the browser
// q_auto: automatic quality optimization
const CLOUDINARY_DEFAULTS = 'f_auto,q_auto';

export function resolveImageUrl(src, options = {}) {
  if (!src) return src;

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

// Get optimal image size based on container width
export function getOptimalImageSize(containerWidth, breakpoints = [320, 640, 960, 1280, 1920]) {
  return breakpoints.find((bp) => bp >= containerWidth) || breakpoints[breakpoints.length - 1];
}

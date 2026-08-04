import { API_URL } from '../config';

export function resolveImageUrl(src) {
  if (!src) return src;
  if (src.startsWith('/uploads/')) {
    return `${API_URL}${src}`;
  }
  return src;
}

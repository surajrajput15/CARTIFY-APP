import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadImage } from './productsApi';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

// Regression: the axios instance defaults to Content-Type application/json, and
// axios 1.18 stringifies FormData to {"image":{}} whenever that header is
// present — the server then answers 400 "Please select an image" and product
// adds fail for lack of an image URL.
describe('uploadImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts multipart field "image" with the Content-Type header stripped', async () => {
    api.post.mockResolvedValue({ data: { image: 'https://res.cloudinary.com/x.jpg' } });
    const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });

    const promise = uploadImage(file);

    expect(api.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = api.post.mock.calls[0];
    expect(url).toBe('/api/upload');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('image')).toBe(file);
    expect(config).toBeDefined();
    expect(config.headers['Content-Type']).toBeNull();

    await expect(promise).resolves.toEqual({
      data: { image: 'https://res.cloudinary.com/x.jpg' }
    });
  });

  it('rejects as-is so callers can surface the server message in a toast', async () => {
    const error = { response: { data: { message: 'Invalid image. Only JPEG, PNG & WebP images are allowed' } } };
    api.post.mockRejectedValue(error);

    await expect(uploadImage(new File(['x'], 'x.png', { type: 'image/png' }))).rejects.toBe(error);
  });
});

const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { protect, admin } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Cloudinary is preferred for production (persistent, CDN-backed). When its env
// vars are configured we upload there; otherwise we fall back to the local disk
// (fine for development, but images vanish on Render restarts).
const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Detect the true image format from its magic bytes, never trusting the
// client-supplied mimetype or the original filename extension.
const MAGIC_MAP = [
  { magic: [0xff, 0xd8, 0xff], ext: '.jpg', type: 'image/jpeg' },
  { magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: '.png', type: 'image/png' },
  { magic: [0x52, 0x49, 0x46, 0x46], ext: '.webp', type: 'image/webp' },
];

const detectImage = (buffer) => {
  for (const { magic, ext, type } of MAGIC_MAP) {
    if (buffer.length >= magic.length && magic.every((b, i) => buffer[i] === b)) {
      // WebP files carry 'WEBP' at bytes 8-11; validate to avoid a false positive
      // on the generic 'RIFF' header.
      if (ext === '.webp') {
        const isWebP = buffer.length >= 12 &&
          buffer.toString('ascii', 8, 12) === 'WEBP';
        if (!isWebP) continue;
      }
      return { ext, type };
    }
  }
  return null;
};

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/', protect, admin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please select an image' });
    }

    const detected = detectImage(req.file.buffer);
    if (!detected) {
      return res.status(400).json({
        message: 'Invalid image. Only JPEG, PNG & WebP images are allowed'
      });
    }

    // Unique, unpredictable public id so a crafted *.html / *.svg payload can
    // never be stored or served, and images cannot collide.
    const publicId = `cartify/${crypto.randomBytes(16).toString('hex')}`;

    const finishUpload = (url) => {
      res.status(200).json({ message: 'Image uploaded successfully', image: url });
    };

    if (hasCloudinary) {
      const uploadStream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: 'image' },
        (cloudErr, result) => {
          if (cloudErr || !result?.secure_url) {
            console.error('Cloudinary upload error:', cloudErr?.message || 'no url returned');
            return res.status(500).json({ message: 'Failed to save image' });
          }
          finishUpload(result.secure_url);
        }
      );
      uploadStream.end(req.file.buffer);
      return;
    }

    // Fallback: local disk (development only). The extension is derived from the
    // detected format so a crafted payload can never be written with a bad extension.
    const safeName = crypto.randomBytes(16).toString('hex') + detected.ext;
    const filePath = path.join(UPLOAD_DIR, safeName);

    fs.writeFile(filePath, req.file.buffer, (writeErr) => {
      if (writeErr) {
        console.error('Upload write error:', writeErr.message);
        return res.status(500).json({ message: 'Failed to save image' });
      }
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      finishUpload(`${baseUrl}/uploads/${safeName}`);
    });
  });
});

// Ensure the uploads directory exists up-front so first uploads never fail sync.
fs.mkdir(UPLOAD_DIR, { recursive: true }, () => {});

module.exports = { router, UPLOAD_DIR, hasCloudinary };
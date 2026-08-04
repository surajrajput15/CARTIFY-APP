const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, admin } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG & WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/', protect, admin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Please select an image' });
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.status(200).json({ message: 'Image uploaded successfully', image: imageUrl });
  });
});

module.exports = router;

const errorHandler = (err, req, res, next) => {
  console.error("❌ Server Error:", {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Invalid data provided' });
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: 'Duplicate field value' });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Resource not found' });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large' });
    }
    return res.status(400).json({ message: err.message });
  }

  res.status(err.statusCode || 500).json({
    message: 'Internal server error'
  });
};

module.exports = errorHandler;

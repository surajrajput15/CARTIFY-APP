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

  // express.json() payload exceeded the 10kb body limit — client needs to know it was a
  // size problem (413), not a generic server failure (500).
  if (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError') {
    return res.status(413).json({ message: 'Request body too large' });
  }

  res.status(err.statusCode || 500).json({
    message: 'Internal server error'
  });
};

module.exports = errorHandler;

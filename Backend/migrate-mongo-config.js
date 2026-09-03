// migrate-mongo configuration
module.exports = {
  mongodb: {
    url: process.env.MONGO_URI || 'mongodb://localhost:27017/cartify',

    // Use transactions if MongoDB supports them
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // The migrations dir
  migrationsDir: 'migrations',

  // The collection that stores applied migrations
  changelogCollectionName: 'changelog',

  // The file extension to create migrations
  migrationFileExtension: '.js',

  // Enable the algorithm to create a hash of the file contents
  // to avoid re-running applied migrations
  useFileHash: true,
};

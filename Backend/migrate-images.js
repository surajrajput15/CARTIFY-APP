const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
console.log('Dotenv loaded from:', path.resolve(__dirname, '.env'));
console.log('MONGO_URI:', process.env.MONGO_URI);
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);

const mongoose = require('mongoose');
const https = require('https');
const cloudinary = require('cloudinary').v2;

// Configure cloudinary (should already be configured via env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Cloudinary configured');

// Connect to MongoDB
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI is not defined');
  process.exit(1);
}
mongoose.connect(uri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Test Cloudinary API credentials
console.log('Testing Cloudinary API credentials...');
cloudinary.api.account_details()
  .then((result) => {
    console.log('Cloudinary account details test succeeded:', result);
  })
  .catch((err) => {
    console.error('Cloudinary API test failed:', err);
  });

// Define Product schema (same as in models/Product.js)
const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  brand: { type: String },
  stock: { type: Number, required: true },
  ratings: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  image: { type: String, required: true },
  numReviews: { type: Number, default: 0 },
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// Helper function to make a GET request and return buffer
function httpGetBuffer(url) {
  return new Promise((resolve, reject) => {
    // Ensure we use HTTPS
    const lib = url.startsWith('https') ? https : require('http');
    const request = lib.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://commons.wikimedia.org/'
      } 
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP ${response.statusCode}`));
        response.resume(); // consume response data to free up memory
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      );
    });
    request.on('error', (err) => {
      reject(err);
    });
    request.end();
  });
}

// Helper function to make a GET request and return JSON
async function httpGetJson(url) {
  try {
    const buffer = await httpGetBuffer(url);
    return JSON.parse(buffer.toString());
  } catch (error) {
    throw new Error(`Failed to fetch JSON from ${url}: ${error.message}`);
  }
}

// Function to slugify a string for public_id
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+|-+$/g, '');       // Trim - from start and end
}

// Delay function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to search Wikimedia Commons for an image
async function getWikimediaImageUrl(productName) {
  try {
    // Search for files in Wikimedia Commons
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(productName)}&srnamespace=6&format=json&origin=*`;
    await delay(500); // delay between requests
    const data = await httpGetJson(searchUrl);
    
    if (!data.query || !data.query.search || data.query.search.length === 0) {
      return null;
    }
    
    // Get the first result
    const firstResult = data.query.search[0];
    const title = firstResult.title; // e.g., "File:MacBook Pro 14 M3.jpg"
    
    // Get the file info to get the direct image URL
    const fileInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(title)}&format=json&origin=*`;
    await delay(500); // delay between requests
    const fileInfoData = await httpGetJson(fileInfoUrl);
    
    const pages = fileInfoData.query.pages;
    const pageId = Object.keys(pages)[0];
    const pageInfo = pages[pageId];
    if (!pageInfo || !pageInfo.imageinfo || pageInfo.imageinfo.length === 0) {
      return null;
    }
    
    // Return the direct image URL (we can choose a reasonable size; we'll use the original)
    return pageInfo.imageinfo[0].url;
  } catch (error) {
    console.error(`Error getting Wikimedia image for ${productName}:`, error.message);
    return null;
  }
}

// Function to download image as buffer
async function downloadImageBuffer(url) {
  try {
    await delay(500); // delay before download
    return await httpGetBuffer(url);
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error.message);
    return null;
  }
}

// Function to upload buffer to Cloudinary using upload_stream
async function uploadToCloudinary(buffer, publicId) {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'cartify', 
          public_id: publicId, 
          overwrite: true,
          resource_type: 'auto' // automatically detect image/video/etc
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error(`Error uploading to Cloudinary for publicId ${publicId}:`, error.message);
    throw error;
  }
}

// Main migration function
async function migrateImages() {
  try {
    const products = await Product.find({});
    console.log(`Found ${products.length} products`);
    
    // Test Cloudinary upload with a tiny PNG
    console.log('Testing Cloudinary upload...');
    const testBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'); // 1x1 transparent PNG
    try {
      const testResult = await uploadToCloudinary(testBuffer, 'test_' + Date.now());
      console.log('Test upload successful:', testResult.secure_url);
    } catch (testError) {
      console.error('Test upload failed:', testError);
    }
    
    let successCount = 0;
    let failCount = 0;
    const failedProducts = [];
    
    for (const [index, product] of products.entries()) {
      console.log(`\n[${index + 1}/${products.length}] Processing: ${product.title} (${product.category})`);
      
      // Skip if image already looks like a Cloudinary URL (already migrated)
      if (product.image && product.image.includes('res.cloudinary.com')) {
        console.log('  -> Already has Cloudinary image, skipping');
        successCount++;
        // Delay after each product to avoid rate limiting
        if (index < products.length - 1) await delay(1000);
        continue;
      }
      
      // Try to get image from Wikimedia
      let imageUrl = await getWikimediaImageUrl(product.title);
      if (!imageUrl) {
        console.log('  -> No image found on Wikimedia');
        failCount++;
        failedProducts.push({ product: product.title, reason: 'No Wikimedia image' });
        // Delay after each product
        if (index < products.length - 1) await delay(1000);
        continue;
      }
      console.log(`  -> Found image: ${imageUrl}`);
      
      // Download image
      const buffer = await downloadImageBuffer(imageUrl);
      if (!buffer) {
        console.log('  -> Failed to download image');
        failCount++;
        failedProducts.push({ product: product.title, reason: 'Download failed' });
        // Delay after each product
        if (index < products.length - 1) await delay(1000);
        continue;
      }
      console.log(`  -> Downloaded image (${buffer.length} bytes)`);
      
      // Generate public_id
      const publicId = slugify(product.title);
      
      // Upload to Cloudinary
      let uploadResult;
      try {
        uploadResult = await uploadToCloudinary(buffer, publicId);
      } catch (uploadError) {
        console.log('  -> Cloudinary upload failed');
        failCount++;
        failedProducts.push({ product: product.title, reason: 'Upload failed' });
        // Delay after each product
        if (index < products.length - 1) await delay(1000);
        continue;
      }
      
      const secureUrl = uploadResult.secure_url;
      console.log(`  -> Uploaded to Cloudinary: ${secureUrl}`);
      
      // Update product
      product.image = secureUrl;
      await product.save();
      console.log(`  -> Updated product in MongoDB`);
      
      successCount++;
      
      // Delay after each product to avoid rate limiting
      if (index < products.length - 1) await delay(1000);
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`Total products: ${products.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    
    if (failedProducts.length > 0) {
      console.log('\nFailed products:');
      failedProducts.forEach(fp => {
        console.log(`  - ${fp.product}: ${fp.reason}`);
      });
    }
    
    // Disconnect
    await mongoose.disconnect();
    console.log('\nMigration completed.');
  } catch (error) {
    console.error('Migration failed:', error);
    await mongoose.disconnect();
  }
}

// Run the migration
migrateImages();
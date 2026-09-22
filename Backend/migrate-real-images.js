const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const https = require('https');
const http = require('http');
const cloudinary = require('cloudinary').v2;
const Product = require('./models/Product');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/cartify';

const TITLES = {
  "MacBook Pro 14\" M3": "File:M3 Macbook Pro 14 inch Space Grey model (cropped).jpg",
  "iPhone 15 Pro Max": "File:Apple iPhone 15 Pro.jpg",
  "Sony WH-1000XM5": "File:Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.jpg",
  "Samsung Galaxy S24 Ultra": "File:SAMSUNG Galaxy S24 Ultra (5).jpg",
  "Apple AirPods Pro 2": "File:AirPods Pro (2nd generation).jpg",
  "Sony PlayStation 5 Slim": "File:PlayStation 5 and DualSense with transparent background.png",
  "Dell UltraSharp 27\" 4K": "File:3x Dell Ultrasharps.jpg",
  "JBL Flip 6 Speaker": "File:JBL Flip 4.jpg",
  "Noise Cancelling Earbuds": "File:ActiveSound wireless earbuds by Hykker (POJM200483).jpg",
  "OnePlus 12": "File:OnePlus 8T Front View.png",
  "MacBook Air M3": "File:Hardware PXL 20240701 181416002 (53829190029).jpg",
  "Bose QuietComfort Ultra": "File:Bose QuietComfort Ultra Earbuds - 3.jpg",
  "LG OLED C3 55 inch TV": "File:IFA 2012 LG전자 OLED TV (2).jpg",
  "Apple Watch Series 9": "File:Apple Watch Series 9 1 2023-11-14.jpg",
  "Canon EOS R50": "File:Canon EOS R50+RF-S 55-210mm f5-7.1 IS STM.jpg",
  "Realme GT 6": "File:Realme GT Neo3 back.jpg",
  "Google Pixel 8": "File:Google Pixel 8 Rose rear.jpg",
  "Levi's 501 Original Jeans": "File:Levi's 501 'big E' Red Tab (2025-12-30).jpg",
  "Puma Hoodie": "File:Hoodie m7agar.jpg",
  "Zara Formal Blazer": "File:Gray blazer brown shirt black split skirt sheer tights and strappy heels - modeled by Marina Daschner.jpg",
  "H&M Cotton T-Shirt": "File:T-Shirt Wikipedia white.jpg",
  "Allen Solly Chinos": "File:Chino pants.jpg",
  "Wrangler Denim Jacket": "File:Jean jacket.jpg",
  "Nike Dri-FIT Shorts": "File:Black Shorts Front Rinse (36590637246).jpg",
  "Under Armour Polo": "File:WP polo shirt FRONT Merchandise shots-24 cropped.jpg",
  "Nike Air Force 1 '07": "File:Air Force 1.JPG",
  "Adidas Ultraboost Light": "File:Adidas Ultra Boost 4 running shoes.jpeg",
  "New Balance 574": "File:New Balance 574.jpg",
  "Puma RS-X": "File:Puma Clyde leather blue.jpg",
  "Crocs Classic Clog": "File:Crocs-synthetic-clogs.jpg",
  "Woodland Boots": "File:Brown leather boots on a wood floor (Unsplash).jpg",
  "Ray-Ban Aviator Sunglasses": "File:Ray-Ban Aviator sunglasses.jpg",
  "Titan Smart Watch": "File:Huawei Smartwatch Fit 2.jpg",
  "Casio G-Shock": "File:CASIO G-Shock GW-M5610U.jpg",
  "Fossil Leather Wallet": "File:Aarong leather wallet.jpg",
  "Samsonite Backpack": "File:Samsonite-MA1232092002.jpg",
  "Wooden Study Table": "File:STUDY AND ACCOUNTS TABLE.jpg",
  "Ergonomic Office Chair": "File:ErgoFlip Active Ergonomic Chair eye view.jpg",
  "IKEA KALLAX Shelf": "File:Part of an IKEA bookshelf with popular fiction etc.jpg",
  "Wakefit Orthopaedic Mattress": "File:MemoryFoam-fast.jpg",
  "Boho Floor Lamp": "File:Floor lamp 1 2016-07-06.jpg",
  "Maybelline Fit Me Foundation": "File:Fit Me! Maybelline Review.jpg",
  "Lakme Absolute Lipstick": "File:Lakme 9 to 5 Scarlet Surge Primer+Matte Lipstick MR22.jpg",
  "MAC Ruby Woo Lipstick": "File:Lipstick mac day 4.jpg",
  "Nivea Sunscreen SPF 50": "File:Sonnencremespender Nivea Gärten der Welt Berlin-Marzahn.jpg",
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function slugify(text) {
  return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+|-+$/g, '');
}
function detectImage(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  return null;
}
function httpGetBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'CartifyImageMigration/3.0 (dev@cartify.local)', Accept: 'image/*' },
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return resolve(httpGetBuffer(response.headers.location, redirects + 1));
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      const chunks = [];
      response.on('data', c => chunks.push(c));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'CartifyImageMigration/3.0 (dev@cartify.local)' } }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function batchResolveImageUrls() {
  const urlMap = {};
  const entries = Object.entries(TITLES);
  for (let i = 0; i < entries.length; i += 12) {
    const chunk = entries.slice(i, i + 12);
    const titlesParam = chunk.map(([, t]) => t).join('|');
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size&iiurlwidth=1200&format=json&origin=*&titles=' + encodeURIComponent(titlesParam);
    const data = await httpGetJson(url);
    const pages = data?.query?.pages || {};
    for (const p of Object.values(pages)) {
      const miss = typeof p.missing !== 'undefined';
      const thumb = p.imageinfo?.[0]?.thumburl;
      if (miss || !thumb) {
        console.log(`  MISSING: ${p.title}`);
        continue;
      }
      // find product title by matching the File: title
      const prodTitle = chunk.find(([, t]) => t === p.title)?.[0];
      if (prodTitle) {
        urlMap[prodTitle] = thumb;
        console.log(`  RESOLVED: ${prodTitle} => ${thumb.slice(0, 80)}...`);
      }
    }
    await delay(1200);
  }
  return urlMap;
}

async function uploadWithRetry(buffer, publicId) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'cartify/products', public_id: publicId, overwrite: true, resource_type: 'image', timeout: 20000 },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(buffer);
      });
    } catch (e) {
      lastErr = e;
      console.log(`    upload retry ${attempt}/4: ${e.message}`);
      await delay(3000 * attempt);
    }
  }
  throw lastErr;
}

async function main() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const products = await Product.find({}).lean();
  console.log('TOTAL PRODUCTS:', products.length);

  console.log('\n--- Phase 1: Batch-resolving Wikimedia image URLs ---');
  const urlMap = await batchResolveImageUrls();
  console.log(`Resolved ${Object.keys(urlMap).length}/${products.length} URLs`);

  console.log('\n--- Phase 2: Download, upload to Cloudinary, update MongoDB ---');
  let ok = 0, failed = 0, skipped = 0;
  const failedList = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/${products.length}] ${product.title}`);

    if (product.image && product.image.includes('res.cloudinary.com')) {
      console.log('  already on Cloudinary, skipping');
      ok++; skipped++; continue;
    }

    const imageUrl = urlMap[product.title];
    if (!imageUrl) {
      console.log('  NO RESOLVED URL');
      failed++; failedList.push(product.title); continue;
    }

    let buffer = null;
    for (let attempt = 1; attempt <= 3 && !buffer; attempt++) {
      try {
        const raw = await httpGetBuffer(imageUrl);
        const ext = detectImage(raw);
        if (ext) {
          buffer = raw;
        } else {
          console.log(`    download ${attempt}/3: unrecognized format`);
          await delay(2000);
        }
      } catch (e) {
        console.log(`    download ${attempt}/3 error: ${e.message}`);
        await delay(2000);
      }
    }
    if (!buffer) {
      console.log('  DOWNLOAD FAILED');
      failed++; failedList.push(product.title); continue;
    }
    console.log(`  downloaded ${buffer.length} bytes`);

    const publicId = slugify(product.title);
    let uploaded;
    try {
      uploaded = await uploadWithRetry(buffer, publicId);
    } catch (e) {
      console.log('  UPLOAD FAILED:', e.message);
      failed++; failedList.push(product.title); continue;
    }
    if (!uploaded?.secure_url) {
      console.log('  NO SECURE URL');
      failed++; failedList.push(product.title); continue;
    }

    await Product.updateOne({ _id: product._id }, { $set: { image: uploaded.secure_url } });
    ok++;
    console.log(`  OK => ${uploaded.secure_url}`);
    await delay(600);
  }

  console.log('\n================ SUMMARY ================');
  console.log('OK:', ok, 'FAILED:', failed, 'SKIPPED(already cloudinary):', skipped);
  if (failedList.length) console.log('FAILED PRODUCTS:', failedList.join(' | '));
  await mongoose.disconnect();
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
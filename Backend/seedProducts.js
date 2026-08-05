const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product'); 

dotenv.config();

// MONGODB CONNECTION (Fixed for newer versions)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected for Seeding...'))
  .catch(err => console.log('Connection Error:', err));

// PREMIUM DUMMY PRODUCTS DATA
const premiumProducts = [
    // Electronics - Laptops & Mobiles
    { title: "MacBook Pro 16-inch (M3 Max)", price: 319900, countInStock: 20, category: "Electronics", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80", description: "Supercharged by M3 Max, 36GB RAM, 1TB SSD. The ultimate pro laptop." },
    { title: "iPhone 15 Pro Max", price: 159900, countInStock: 20, category: "Electronics", image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80", description: "Titanium design, A17 Pro chip, 48MP camera system." },
    { title: "Samsung Galaxy S24 Ultra", price: 129999, countInStock: 20, category: "Electronics", image: "https://images.unsplash.com/photo-1706697850027-4f40f095d3e0?w=800&q=80", description: "Galaxy AI is here. Titanium exterior, 200MP camera." },
    { title: "Sony PlayStation 5 Console", price: 54990, countInStock: 20, category: "Electronics", image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&q=80", description: "Experience lightning-fast loading with an ultra-high speed SSD." },
    { title: "Dell XPS 15 OLED", price: 185000, countInStock: 20, category: "Electronics", image: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&q=80", description: "Stunning 3.5K OLED display, Intel Core i9, NVIDIA RTX 4070." },
    
    // Audio & Wearables
    { title: "AirPods Pro (2nd Generation)", price: 24900, countInStock: 20, category: "Accessories", image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&q=80", description: "Active Noise Cancellation, Adaptive Audio, USB-C." },
    { title: "Sony WH-1000XM5 Headphones", price: 29990, countInStock: 20, category: "Accessories", image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80", description: "Industry-leading noise canceling overhead headphones." },
    { title: "Apple Watch Series 9", price: 41900, countInStock: 20, category: "Accessories", image: "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800&q=80", description: "Smarter. Brighter. Mightier. Double tap gesture." },
    
    // Fashion - Men
    { title: "Men's Classic Leather Jacket", price: 5999, countInStock: 20, category: "Men", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80", description: "Premium genuine leather biker jacket in black." },
    { title: "Nike Air Jordan 1 Retro", price: 14995, countInStock: 20, category: "Men", image: "https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=800&q=80", description: "Iconic high-top sneakers, Chicago colorway." },
    { title: "Premium Cotton Slim Fit Shirt", price: 1899, countInStock: 20, category: "Men", image: "https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?w=800&q=80", description: "Breathable pure cotton, perfect for office or casual wear." },
    { title: "Levi's 511 Slim Fit Jeans", price: 2599, countInStock: 20, category: "Men", image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80", description: "Modern slim fit with room to move. Dark wash." },
    
    // Fashion - Women
    { title: "Floral Summer Maxi Dress", price: 2499, countInStock: 20, category: "Women", image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&q=80", description: "Lightweight, breathable floral dress perfect for summer." },
    { title: "Designer Leather Handbag", price: 8500, countInStock: 20, category: "Women", image: "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=800&q=80", description: "Elegant tote bag with premium leather finish." },
    { title: "Women's Running Shoes", price: 4999, countInStock: 20, category: "Women", image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80", description: "Lightweight mesh sneakers for everyday comfort." },
    { title: "Gold Plated Minimalist Necklace", price: 1299, countInStock: 20, category: "Women", image: "https://images.unsplash.com/photo-1599643478514-4a4208035ed8?w=800&q=80", description: "18k gold plated dainty chain with pendant." },
    
    // Home & Living
    { title: "Modern Velvet Sofa", price: 45000, countInStock: 20, category: "Home", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80", description: "Mid-century modern 3-seater sofa in emerald green velvet." },
    { title: "Smart LED Table Lamp", price: 2100, countInStock: 20, category: "Home", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80", description: "WiFi enabled, app controlled adjustable lighting." },
    { title: "Ceramic Coffee Mug Set", price: 899, countInStock: 20, category: "Home", image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80", description: "Set of 4 artisan crafted ceramic mugs." },
    
    // Extra Electronics
    { title: "Canon EOS R5 Camera", price: 339990, countInStock: 20, category: "Electronics", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80", description: "45MP full-frame mirrorless camera with 8K video." },
    { title: "Logitech MX Master 3S Mouse", price: 9495, countInStock: 20, category: "Electronics", image: "https://images.unsplash.com/photo-1615663245857-ac9310d5b1ff?w=800&q=80", description: "Advanced wireless mouse with ultra-fast scrolling." }
];

// FUNCTION TO SEED DATABASE
const seedDatabase = async () => {
    try {
        await Product.insertMany(premiumProducts);
        console.log(`✅ Success! Added ${premiumProducts.length} Premium Products!`);
        process.exit(); 
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedDatabase();
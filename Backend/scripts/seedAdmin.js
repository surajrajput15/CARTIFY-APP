const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

const seedAdmins = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/cartify';
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    const defaultPassword = 'Admin@12345';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    const adminsToSeed = [
      {
        name: 'System Admin',
        email: 'admin@cartify.com',
        role: 'super_admin',
        isAdmin: true,
        status: 'active',
      },
      {
        name: 'Suraj Kumar',
        email: 'surajdona2005@gmail.com',
        role: 'super_admin',
        isAdmin: true,
        status: 'active',
      },
    ];

    for (const adminData of adminsToSeed) {
      let user = await User.findOne({ email: adminData.email });
      if (user) {
        user.name = adminData.name;
        user.password = hashedPassword;
        user.role = adminData.role;
        user.isAdmin = adminData.isAdmin;
        user.status = adminData.status;
        await user.save();
        console.log(`Updated existing admin user: ${adminData.email}`);
      } else {
        user = await User.create({
          ...adminData,
          password: hashedPassword,
        });
        console.log(`Created new admin user: ${adminData.email}`);
      }
    }

    console.log('\nAdmin credentials initialized successfully:');
    console.log('----------------------------------------------------');
    console.log('Email:    admin@cartify.com');
    console.log('Password: Admin@12345');
    console.log('Role:     super_admin (Full Admin Control & Operational Access)');
    console.log('----------------------------------------------------');
    console.log('Email:    surajdona2005@gmail.com');
    console.log('Password: Admin@12345');
    console.log('Role:     super_admin');
    console.log('----------------------------------------------------\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
};

seedAdmins();

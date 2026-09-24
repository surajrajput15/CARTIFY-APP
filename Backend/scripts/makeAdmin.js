// Run: node scripts/makeAdmin.js <email>
// Makes a user an admin by their email

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const User = require('../models/User');
const { isOwnerEmail } = require('../utils/ownerValidator');

const emailArg = process.argv[2];
if (!emailArg) {
  console.log('Usage: node scripts/makeAdmin.js <email>');
  process.exit(1);
}
const email = String(emailArg).trim().toLowerCase();

// Owner-only guard: ONLY the allowlisted owner email may ever be promoted to
// admin. Any other address is rejected outright — scripts cannot mint admins.
if (!isOwnerEmail(email)) {
  console.log(`❌ Refused: ${email} is not on the owner allowlist (ADMIN_EMAILS). Only the owner can be admin.`);
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User with email ${email} not found`);
      process.exit(1);
    }
    user.isAdmin = true;
    await user.save();
    console.log(`✅ ${email} is now an admin!`);
    process.exit(0);
  })
  .catch((err) => {
    console.log('Error:', err);
    process.exit(1);
  });

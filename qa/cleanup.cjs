const { loadBackendEnv, getMongoose, assertLocalDb } = require('./qa-utils.cjs');
loadBackendEnv();
const mongoose = getMongoose();
assertLocalDb();
mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 }).then(async () => {
  const db = mongoose.connection.db;
  const qa = await db.collection('users').find({ $or: [{ email: /@(test|t)\.com$/ }, { email: 'notanemail' }] }).toArray();
  const ids = qa.map(u => u._id);
  const ors = await db.collection('orders').deleteMany({ userId: { $in: ids } });
  const ars = await db.collection('addresses').deleteMany({ userId: { $in: ids } });
  const urs = await db.collection('users').deleteMany({ _id: { $in: ids } });
  console.log('deleted orders:', ors.deletedCount, 'addresses:', ars.deletedCount, 'users:', urs.deletedCount);
  console.log('remaining users:', await db.collection('users').countDocuments(), 'orders:', await db.collection('orders').countDocuments(), 'addresses:', await db.collection('addresses').countDocuments());
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });

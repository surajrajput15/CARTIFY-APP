module.exports = {
  async up(db, client) {
    // Add indexes to User collection
    const userCollection = db.collection('users');
    await userCollection.createIndex({ email: 1 }, { unique: true });
    await userCollection.createIndex({ isAdmin: 1 });
    await userCollection.createIndex({ createdAt: -1 });
    await userCollection.createIndex({ refreshToken: 1 });

    // Add indexes to Product collection
    const productCollection = db.collection('products');
    await productCollection.createIndex({ category: 1 });
    await productCollection.createIndex({ title: 1 });
    await productCollection.createIndex({ createdAt: -1 });
    await productCollection.createIndex({ category: 1, price: 1 });
    await productCollection.createIndex({ category: 1, createdAt: -1 });
    await productCollection.createIndex({ title: 'text', description: 'text' });

    // Add indexes to Order collection
    const orderCollection = db.collection('orders');
    await orderCollection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
    await orderCollection.createIndex({ userId: 1, createdAt: -1 });
    await orderCollection.createIndex({ status: 1, createdAt: -1 });
    await orderCollection.createIndex({ razorpayOrderId: 1 });
    await orderCollection.createIndex({ razorpayPaymentId: 1 });
    await orderCollection.createIndex({ status: 1, paymentStatus: 1, createdAt: -1 });

    // Add indexes to Cart collection
    const cartCollection = db.collection('carts');
    await cartCollection.createIndex({ userId: 1 }, { unique: true });
    await cartCollection.createIndex({ 'items.productId': 1 });
    await cartCollection.createIndex({ updatedAt: -1 });

    // Add indexes to Address collection
    const addressCollection = db.collection('addresses');
    await addressCollection.createIndex({ userId: 1 });
  },

  async down(db, client) {
    const userCollection = db.collection('users');
    await userCollection.dropIndex('email_1').catch(() => {});
    await userCollection.dropIndex('isAdmin_1').catch(() => {});
    await userCollection.dropIndex('createdAt_-1').catch(() => {});
    await userCollection.dropIndex('refreshToken_1').catch(() => {});

    const productCollection = db.collection('products');
    await productCollection.dropIndex('category_1').catch(() => {});
    await productCollection.dropIndex('title_1').catch(() => {});
    await productCollection.dropIndex('createdAt_-1').catch(() => {});
    await productCollection.dropIndex('category_1_price_1').catch(() => {});
    await productCollection.dropIndex('category_1_createdAt_-1').catch(() => {});
    await productCollection.dropIndex('title_text_description_text').catch(() => {});

    const orderCollection = db.collection('orders');
    await orderCollection.dropIndex('expireAt_1').catch(() => {});
    await orderCollection.dropIndex('userId_1_createdAt_-1').catch(() => {});
    await orderCollection.dropIndex('status_1_createdAt_-1').catch(() => {});
    await orderCollection.dropIndex('razorpayOrderId_1').catch(() => {});
    await orderCollection.dropIndex('razorpayPaymentId_1').catch(() => {});
    await orderCollection.dropIndex('status_1_paymentStatus_1_createdAt_-1').catch(() => {});

    const cartCollection = db.collection('carts');
    await cartCollection.dropIndex('userId_1').catch(() => {});
    await cartCollection.dropIndex('items.productId_1').catch(() => {});
    await cartCollection.dropIndex('updatedAt_-1').catch(() => {});

    const addressCollection = db.collection('addresses');
    await addressCollection.dropIndex('userId_1').catch(() => {});
  },
};
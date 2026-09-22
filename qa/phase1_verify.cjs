/**
 * Phase 1 acceptance checks — Order Delivery Model + Status Workflow.
 *
 * Pure, dependency-free structural assertions (no DB required):
 *  1. orderStatus.js exports everything the phase spec requires.
 *  2. Transition tables behave per spec.
 *  3. Order model exposes the delivery fields/enums + shippingAddress geo fields.
 *  4. orderRoutes.js registers all 10 delivery endpoints with the right guards,
 *     and keeps the 3 pre-existing endpoints untouched.
 *
 * Run: node qa/phase1_verify.cjs
 */
const fs = require('fs');
const path = require('path');

const backend = path.join(__dirname, '..', 'Backend');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

// ---------------------------------------------------------------- 1. utils
const os = require(path.join(backend, 'utils', 'orderStatus.js'));

const mustExport = [
  'orderStatusWorkflow',
  'deliveryStatusWorkflow',
  'isValidOrderTransition',
  'isValidDeliveryTransition',
  'canCancelOrder',
  'canFailDelivery',
];
mustExport.forEach((k) => check(`orderStatus exports ${k}`, typeof os[k] !== 'undefined'));

const specOrderStatuses = [
  'Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped',
  'Out for Delivery', 'Delivered', 'Cancelled', 'Failed', 'Returned', 'Refunded',
];
const missingOrder = specOrderStatuses.filter((s) => !os.orderStatusWorkflow[s]);
check('orderStatusWorkflow covers all 11 spec statuses', missingOrder.length === 0, missingOrder.join(','));

const specDeliveryStatuses = [
  'not_assigned', 'assigned', 'accepted', 'picked_up',
  'out_for_delivery', 'delivered', 'failed', 'cancelled',
];
const missingDelivery = specDeliveryStatuses.filter((s) => !os.deliveryStatusWorkflow[s]);
check('deliveryStatusWorkflow covers all 8 spec statuses', missingDelivery.length === 0, missingDelivery.join(','));

// ------------------------------------------------- 2. transition behaviour
check('Pending -> Processing allowed', os.isValidOrderTransition('Pending', 'Processing') === true);
check('Pending -> Confirmed allowed', os.isValidOrderTransition('Pending', 'Confirmed') === true);
check('Packed -> Shipped allowed', os.isValidOrderTransition('Packed', 'Shipped') === true);
check('Packed -> Out for Delivery allowed', os.isValidOrderTransition('Packed', 'Out for Delivery') === true);
check('Processing -> Out for Delivery allowed', os.isValidOrderTransition('Processing', 'Out for Delivery') === true);
check('Out for Delivery -> Failed allowed', os.isValidOrderTransition('Out for Delivery', 'Failed') === true);
check('Delivered -> Pending rejected', os.isValidOrderTransition('Delivered', 'Pending') === false);
check('Cancelled -> anything rejected', os.isValidOrderTransition('Cancelled', 'Pending') === false);
check('unknown status rejected', os.isValidOrderTransition('Bogus', 'Pending') === false);

check('not_assigned -> assigned allowed', os.isValidDeliveryTransition('not_assigned', 'assigned') === true);
check('assigned -> accepted allowed', os.isValidDeliveryTransition('assigned', 'accepted') === true);
check('accepted -> picked_up allowed', os.isValidDeliveryTransition('accepted', 'picked_up') === true);
check('picked_up -> out_for_delivery allowed', os.isValidDeliveryTransition('picked_up', 'out_for_delivery') === true);
check('out_for_delivery -> delivered allowed', os.isValidDeliveryTransition('out_for_delivery', 'delivered') === true);
check('assigned -> delivered rejected (skips steps)', os.isValidDeliveryTransition('assigned', 'delivered') === false);
check('delivered -> assigned rejected', os.isValidDeliveryTransition('delivered', 'assigned') === false);

['Pending', 'Confirmed', 'Processing'].forEach((s) =>
  check(`canCancelOrder(${s}) true`, os.canCancelOrder(s) === true));
['Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded'].forEach((s) =>
  check(`canCancelOrder(${s}) false`, os.canCancelOrder(s) === false));

['assigned', 'accepted', 'picked_up', 'out_for_delivery'].forEach((s) =>
  check(`canFailDelivery(${s}) true`, os.canFailDelivery(s) === true));
['not_assigned', 'delivered', 'failed', 'cancelled'].forEach((s) =>
  check(`canFailDelivery(${s}) false`, os.canFailDelivery(s) === false));

// ------------------------------------------------------------------ 3. model
const Order = require(path.join(backend, 'models', 'Order.js'));
const shipping = (p) => Order.schema.path(`shippingAddress.${p}`);

check('Order.deliveryPartnerId exists', !!Order.schema.paths.deliveryPartnerId);
check('Order.deliveryPartnerId refs User', Order.schema.paths.deliveryPartnerId.options.ref === 'User');
check('Order.deliveryStatus default not_assigned',
  Order.schema.paths.deliveryStatus.options.default === 'not_assigned');
['assignedAt', 'acceptedAt', 'pickedUpAt', 'outForDeliveryAt', 'deliveredAt', 'failedAt'].forEach((f) =>
  check(`Order.${f} timestamp exists`, !!Order.schema.paths[f]));

const orderEnum = Order.schema.paths.status.enumValues;
const enumDiffs = specOrderStatuses.filter((s) => !orderEnum.includes(s));
check('Order.status enum matches the 11 spec statuses', enumDiffs.length === 0,
  enumDiffs.length ? 'missing: ' + enumDiffs.join(',') : '');

check('shippingAddress.latitude exists', !!shipping('latitude'));
check('shippingAddress.longitude exists', !!shipping('longitude'));

// ------------------------------------------------------- 3b. User + guards
const User = require(path.join(backend, 'models', 'User.js'));
const roleEnum = User.schema.paths.role.enumValues;
['customer', 'admin', 'delivery'].forEach((r) =>
  check(`User.role enum includes '${r}'`, roleEnum.includes(r)));
check("User.role defaults to 'customer'", User.schema.paths.role.options.default === 'customer');
check('User.phone exists (delivery partners must be reachable)',
  !!User.schema.path('phone'));

const auth = require(path.join(backend, 'middleware', 'auth.js'));
const mustExportMiddleware = ['protect', 'admin', 'delivery', 'roleAccess'];
mustExportMiddleware.forEach((m) =>
  check(`auth exports ${m} middleware`, typeof auth[m] === 'function'));

// Exercise the guards directly with fake req/res objects.
const runGuard = (guard, user) => new Promise((resolve) => {
  const res = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json() { resolve(this.statusCode); },
  };
  const next = () => resolve('next');
  guard({ user }, res, next);
});
const guardChecks = (async () => {
  check('delivery guard passes a delivery partner', (await runGuard(auth.delivery, { role: 'delivery' })) === 'next');
  check('delivery guard blocks a customer', (await runGuard(auth.delivery, { role: 'customer' })) === 403);
  check('admin guard passes an admin', (await runGuard(auth.admin, { isAdmin: true })) === 'next');
  check('admin guard blocks a non-admin', (await runGuard(auth.admin, { isAdmin: false })) === 403);
  check('roleAccess("delivery") passes a delivery partner',
    (await runGuard(auth.roleAccess('delivery'), { role: 'delivery' })) === 'next');
  check('roleAccess("delivery") blocks a customer',
    (await runGuard(auth.roleAccess('delivery'), { role: 'customer' })) === 403);
})();

// ----------------------------------------------------------------- 4. routes
const routeSrc = fs.readFileSync(path.join(backend, 'routes', 'orderRoutes.js'), 'utf8');
const expected = [
  ["router.get('/myorders/:userId'", 'GET /myorders/:userId (pre-existing)'],
  ["router.get('/admin'", 'GET /admin (pre-existing)'],
  ["router.patch('/:id/status'", 'PATCH /:id/status (pre-existing)'],
  ["router.post('/:id/assign-delivery'", 'POST /:id/assign-delivery'],
  ["router.post('/:id/accept-delivery'", 'POST /:id/accept-delivery'],
  ["router.post('/:id/pickup-delivery'", 'POST /:id/pickup-delivery'],
  ["router.post('/:id/out-for-delivery'", 'POST /:id/out-for-delivery'],
  ["router.post('/:id/complete-delivery'", 'POST /:id/complete-delivery'],
  ["router.post('/:id/fail-delivery'", 'POST /:id/fail-delivery'],
  ["router.get('/delivery/assigned'", 'GET /delivery/assigned'],
  ["router.get('/delivery/completed'", 'GET /delivery/completed'],
  ["router.get('/delivery/failed'", 'GET /delivery/failed'],
  ["router.get('/admin/delivery'", 'GET /admin/delivery'],
];
expected.forEach(([needle, label]) => {
  const count = routeSrc.split(needle).length - 1;
  check(`${label} registered exactly once`, count === 1,
    count === 0 ? 'missing' : count > 1 ? `${count} copies` : '');
});

check('imports all four orderStatus helpers',
  routeSrc.includes("const { isValidOrderTransition, isValidDeliveryTransition, canCancelOrder, canFailDelivery } = require('../utils/orderStatus');"));
check('uses delivery middleware', routeSrc.includes('protect, delivery,'));
check('assign-delivery is admin-guarded', routeSrc.includes("router.post('/:id/assign-delivery', protect, admin,"));
check('admin/delivery is admin-guarded', routeSrc.includes("router.get('/admin/delivery', protect, admin,"));
check('module.exports = router present', routeSrc.trimEnd().endsWith('module.exports = router;'));

// ----------------------------------------------------------------- summary
guardChecks.then(() => {
  const failed = results.filter((r) => !r.ok);
  console.log('\n----------------------------------------');
  console.log(`Phase 1 checks: ${results.length - failed.length}/${results.length} passed`);
  console.log('----------------------------------------');
  if (failed.length) {
    console.error('\nFailures:');
    failed.forEach((f) => console.error(` - ${f.name} ${f.detail}`));
    process.exit(1);
  }
  console.log('ALL PHASE 1 CHECKS PASSED');
});


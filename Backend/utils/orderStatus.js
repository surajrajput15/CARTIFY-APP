/**
 * Order Status Workflow Utility
 * 
 * Defines allowed state transitions for order lifecycle and delivery tracking.
 * Used to validate status changes and enforce business rules.
 */

// ============================================================================
// ORDER STATUS WORKFLOW
// ============================================================================
/**
 * Complete order status lifecycle with allowed transitions.
 * 
 * Status Flow:
 *   Pending → Confirmed → Processing → Packed → Shipped → Out for Delivery → Delivered
 *     ↓          ↓           ↓           ↓         ↓              ↓
 *   Cancelled  Cancelled   Cancelled   Cancelled Cancelled     Failed/Cancelled
 *                                                      ↓
 *                                                   Returned → Refunded
 * 
 * Transition Rules:
 * - Pending: Order created, payment not yet confirmed. Can move to Confirmed, Processing, or Cancelled.
 * - Confirmed: Payment confirmed, order acknowledged. Can proceed to Processing or be Cancelled.
 * - Processing: Order being prepared. Can move to Packed/Shipped, straight to Out for Delivery
 *   (when a delivery partner takes over), be Cancelled, or Fail.
 * - Packed: Items packed and ready. Can move to Shipped/Out for Delivery, be Cancelled, or Fail.
 * - Shipped: Handed to carrier. Can move to Out for Delivery, be Cancelled, or Fail.
 * - Out for Delivery: With delivery partner. Can be Delivered, Failed, or Cancelled.
 * - Delivered: Successfully delivered. Can be Returned or Refunded.
 * - Cancelled: Order cancelled. Terminal state.
 * - Failed: Delivery failed. Terminal state.
 * - Returned: Item returned by customer. Can be Refunded.
 * - Refunded: Money refunded. Terminal state.
 */
const orderStatusWorkflow = {
    Pending: {
        allowedTransitions: ['Confirmed', 'Processing', 'Cancelled'],
        description: 'Order created, awaiting payment confirmation or preparation'
    },
    Confirmed: {
        allowedTransitions: ['Processing', 'Cancelled'],
        description: 'Payment confirmed, order acknowledged by system'
    },
    Processing: {
        allowedTransitions: ['Packed', 'Shipped', 'Out for Delivery', 'Cancelled', 'Failed'],
        description: 'Order is being prepared/processed for shipment'
    },
    Packed: {
        allowedTransitions: ['Shipped', 'Out for Delivery', 'Cancelled', 'Failed'],
        description: 'Items packed and ready for shipment'
    },
    Shipped: {
        allowedTransitions: ['Out for Delivery', 'Cancelled', 'Failed'],
        description: 'Order handed to shipping carrier'
    },
    'Out for Delivery': {
        allowedTransitions: ['Delivered', 'Failed', 'Cancelled'],
        description: 'Order with delivery partner, en route to customer'
    },
    Delivered: {
        allowedTransitions: ['Returned', 'Refunded'],
        description: 'Order successfully delivered to customer'
    },
    Cancelled: {
        allowedTransitions: [],
        description: 'Order cancelled - terminal state'
    },
    Failed: {
        allowedTransitions: [],
        description: 'Delivery failed - requires manual intervention'
    },
    Returned: {
        allowedTransitions: ['Refunded'],
        description: 'Item returned by customer'
    },
    Refunded: {
        allowedTransitions: [],
        description: 'Refund processed - terminal state'
    }
};

// ============================================================================
// DELIVERY STATUS WORKFLOW
// ============================================================================
/**
 * Delivery-specific status tracking for the assigned delivery partner.
 *
 * Delivery Flow:
 *   not_assigned -> assigned -> accepted -> picked_up -> out_for_delivery -> delivered
 *
 * From any state before 'delivered', the delivery can also become 'failed' or 'cancelled'.
 *
 * Transition Rules:
 * - not_assigned: No partner assigned yet. Only transition is to assigned.
 * - assigned: Partner assigned, awaiting acceptance. Can accept, fail, or be cancelled.
 * - accepted: Partner accepted the job. Can pick up, fail, or be cancelled.
 * - picked_up: Partner collected the parcel. Can go out for delivery, fail, or be cancelled.
 * - out_for_delivery: Parcel is en route. Can be delivered, fail, or be cancelled.
 * - delivered: Completed successfully. Terminal state.
 * - failed: Delivery failed. Terminal state.
 * - cancelled: Delivery cancelled. Terminal state.
 */
const deliveryStatusWorkflow = {
    not_assigned: {
        allowedTransitions: ['assigned'],
        description: 'No delivery partner assigned'
    },
    assigned: {
        allowedTransitions: ['accepted', 'failed', 'cancelled'],
        description: 'Delivery partner assigned, awaiting acceptance'
    },
    accepted: {
        allowedTransitions: ['picked_up', 'failed', 'cancelled'],
        description: 'Delivery partner accepted the assignment'
    },
    picked_up: {
        allowedTransitions: ['out_for_delivery', 'failed', 'cancelled'],
        description: 'Delivery partner picked up the order'
    },
    out_for_delivery: {
        allowedTransitions: ['delivered', 'failed', 'cancelled'],
        description: 'Order is out for delivery'
    },
    delivered: {
        allowedTransitions: [],
        description: 'Delivery completed successfully - terminal state'
    },
    failed: {
        allowedTransitions: [],
        description: 'Delivery failed - terminal state'
    },
    cancelled: {
        allowedTransitions: [],
        description: 'Delivery cancelled - terminal state'
    }
};




// VALIDATION HELPER FUNCTIONS
function isValidOrderTransition(fromStatus, toStatus) {
    if (!fromStatus || !toStatus) return false;
    const workflow = orderStatusWorkflow[fromStatus];
    if (!workflow) return false;
    return workflow.allowedTransitions.includes(toStatus);
}

function isValidDeliveryTransition(fromStatus, toStatus) {
    if (!fromStatus || !toStatus) return false;
    const workflow = deliveryStatusWorkflow[fromStatus];
    if (!workflow) return false;
    return workflow.allowedTransitions.includes(toStatus);
}

/** Check if an order can be cancelled by admin. Only Pending, Confirmed, Processing can be cancelled. */
function canCancelOrder(status) {
    const cancellableStatuses = ['Pending', 'Confirmed', 'Processing'];
    return cancellableStatuses.includes(status);
}

/** Check if a delivery can be marked as failed. Only assigned, accepted, picked_up, out_for_delivery can fail. */
function canFailDelivery(status) {
    const failAllowedStatuses = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];
    return failAllowedStatuses.includes(status);
}

function getValidOrderTransitions(status) {
    const workflow = orderStatusWorkflow[status];
    return workflow ? workflow.allowedTransitions : [];
}

function getValidDeliveryTransitions(status) {
    const workflow = deliveryStatusWorkflow[status];
    return workflow ? workflow.allowedTransitions : [];
}

function getOrderStatusDescription(status) {
    const workflow = orderStatusWorkflow[status];
    return workflow ? workflow.description : 'Unknown status';
}

function getDeliveryStatusDescription(status) {
    const workflow = deliveryStatusWorkflow[status];
    return workflow ? workflow.description : 'Unknown status';
}

module.exports = {
    orderStatusWorkflow,
    deliveryStatusWorkflow,
    isValidOrderTransition,
    isValidDeliveryTransition,
    canCancelOrder,
    canFailDelivery,
    getValidOrderTransitions,
    getValidDeliveryTransitions,
    getOrderStatusDescription,
    getDeliveryStatusDescription
};
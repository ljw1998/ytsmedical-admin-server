const ninjavanService = require('../services/ninjavan.service');
const supabase = require('../config/database');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');
const { NotFoundError, BadRequestError } = require('../utils/errors');

/**
 * Handle NinjaVan webhook - return 200 immediately, process asynchronously
 */
const handleWebhook = async (req, res, next) => {
  // Return 200 immediately to acknowledge receipt
  res.status(200).json({ success: true, message: 'Webhook received' });

  // Process asynchronously
  try {
    const payload = req.body;
    const signature = req.headers['x-ninjavan-hmac-sha256'] || req.headers['x-signature'] || '';
    const rawBody = req.rawBody || JSON.stringify(payload);

    await ninjavanService.processWebhook(payload, signature, rawBody);
  } catch (error) {
    console.error('Webhook processing error:', error.message);
  }
};

/**
 * Generate/download waybill PDF for an order
 */
const generateWaybill = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Look up order to get tracking number
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, tracking_number, ninjavan_waybill_url')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new NotFoundError('Order not found');
    }

    if (!order.tracking_number) {
      throw new BadRequestError('Order does not have a NinjaVan tracking number');
    }

    // If waybill already cached, try to return it
    // Otherwise generate fresh
    const pdfBuffer = await ninjavanService.generateWaybill(order.tracking_number);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=waybill-${order.tracking_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a NinjaVan order
 */
const cancelOrder = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Look up order
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, tracking_number, order_status')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new NotFoundError('Order not found');
    }

    if (!order.tracking_number) {
      throw new BadRequestError('Order does not have a NinjaVan tracking number');
    }

    // Only allow cancellation for created/pending_pickup status
    const cancellableStatuses = ['created', 'pending_pickup'];
    if (!cancellableStatuses.includes(order.order_status)) {
      throw new BadRequestError(
        `Cannot cancel order in '${order.order_status}' status. Only 'created' or 'pending_pickup' orders can be cancelled.`
      );
    }

    await ninjavanService.cancelOrder(order.tracking_number);

    // Update order status to cancelled
    const previousStatus = order.order_status;
    await supabase
      .from('orders')
      .update({ order_status: 'cancelled' })
      .eq('id', orderId);

    // Log status history
    await supabase
      .from('order_status_history')
      .insert({
        order_id: orderId,
        previous_status: previousStatus,
        new_status: 'cancelled',
        source: 'manual',
        notes: 'NinjaVan order cancelled',
        changed_by: req.user?.id || null,
      });

    res.json(formatSuccessResponse({
      message: 'NinjaVan order cancelled successfully',
      data: { order_id: orderId, tracking_number: order.tracking_number },
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Retry failed NinjaVan order creation
 */
const retrySync = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Fetch order with related data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers!customer_id(id, name, phone, email),
        shipping_address:customer_addresses!shipping_address_id(*),
        fulfilment_location:storage_locations!fulfilment_location_id(*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new NotFoundError('Order not found');
    }

    if (!order.ninjavan_sync_failed) {
      throw new BadRequestError('Order does not have a failed NinjaVan sync');
    }

    if (order.fulfilment_type !== 'ninjavan') {
      throw new BadRequestError('Order fulfilment type is not NinjaVan');
    }

    const result = await ninjavanService.createOrder(
      order,
      order.customer,
      order.shipping_address,
      order.fulfilment_location
    );

    res.json(formatSuccessResponse({
      message: 'NinjaVan order sync retried successfully',
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleWebhook,
  generateWaybill,
  cancelOrder,
  retrySync,
};

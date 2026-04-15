const supabase = require('../config/database');
const { PAGINATION } = require('../config/constants');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/errors');
const { generateOrderNumber, roundMoney } = require('../utils/helpers');

/**
 * List orders with pagination and filters
 */
const listOrders = async (filters = {}) => {
  const {
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    order_status,
    order_source,
    payment_status,
    fulfilment_type,
    customer_id,
    source_campaign_id,
    date_from,
    date_to,
    search,
  } = filters;

  const effectiveLimit = Math.min(limit, PAGINATION.MAX_LIMIT);
  const offset = (page - 1) * effectiveLimit;

  let query = supabase
    .from('orders')
    .select(`
      *,
      customer:customers!customer_id(id, name, phone),
      campaign:campaigns!source_campaign_id(id, campaign_name)
    `, { count: 'exact' });

  if (order_status) {
    query = query.eq('order_status', order_status);
  }
  if (order_source) {
    query = query.eq('order_source', order_source);
  }
  if (payment_status) {
    query = query.eq('payment_status', payment_status);
  }
  if (fulfilment_type) {
    query = query.eq('fulfilment_type', fulfilment_type);
  }
  if (customer_id) {
    query = query.eq('customer_id', customer_id);
  }
  if (source_campaign_id) {
    query = query.eq('source_campaign_id', source_campaign_id);
  }
  if (date_from) {
    query = query.gte('order_date', date_from);
  }
  if (date_to) {
    query = query.lte('order_date', date_to);
  }
  if (search) {
    query = query.ilike('order_number', `%${search}%`);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + effectiveLimit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new BadRequestError(`Failed to fetch orders: ${error.message}`);
  }

  return {
    data,
    pagination: {
      page,
      limit: effectiveLimit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / effectiveLimit),
    },
  };
};

/**
 * Get order by ID with all related data
 */
const getOrderById = async (id) => {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers!customer_id(id, name, phone, email),
      shipping_address:customer_addresses!shipping_address_id(*),
      campaign:campaigns!source_campaign_id(id, campaign_name),
      fulfilment_location:storage_locations!fulfilment_location_id(id, location_name),
      order_items(*),
      order_payments(*),
      order_status_history(*)
    `)
    .eq('id', id)
    .single();

  if (error || !order) {
    throw new NotFoundError('Order not found');
  }

  // Sort status history by created_at descending
  if (order.order_status_history) {
    order.order_status_history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return order;
};

/**
 * Create a new order
 */
const createOrder = async (data, userId) => {
  const {
    customer_id,
    order_source,
    payment_type,
    fulfilment_type,
    items,
    shipping_address_id,
    fulfilment_location_id,
    shipping_fee = 0,
    discount = 0,
    notes,
  } = data;

  // Generate order number
  const order_number = await generateOrderNumber(supabase);

  // Look up prices for items and calculate subtotal
  let subtotal = 0;
  const orderItems = [];

  for (const item of items) {
    let itemData;

    if (item.item_type === 'product') {
      const { data: product, error } = await supabase
        .from('products')
        .select('id, sku, product_name, selling_price')
        .eq('id', item.item_id)
        .single();

      if (error || !product) {
        throw new BadRequestError(`Product not found: ${item.item_id}`);
      }

      itemData = {
        item_type: 'product',
        item_id: product.id,
        sku: product.sku,
        item_name: product.product_name,
        quantity: item.quantity,
        unit_price: product.selling_price,
        line_total: roundMoney(product.selling_price * item.quantity),
      };
    } else if (item.item_type === 'bundle') {
      const { data: bundle, error } = await supabase
        .from('bundles')
        .select('id, sku, bundle_name, selling_price')
        .eq('id', item.item_id)
        .single();

      if (error || !bundle) {
        throw new BadRequestError(`Bundle not found: ${item.item_id}`);
      }

      itemData = {
        item_type: 'bundle',
        item_id: bundle.id,
        sku: bundle.sku,
        item_name: bundle.bundle_name,
        quantity: item.quantity,
        unit_price: bundle.selling_price,
        line_total: roundMoney(bundle.selling_price * item.quantity),
      };
    }

    subtotal = roundMoney(subtotal + itemData.line_total);
    orderItems.push(itemData);
  }

  const total_amount = roundMoney(subtotal + parseFloat(shipping_fee) - parseFloat(discount));

  // Detect order_type: new vs repeat
  const { count: customerOrderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer_id);

  const order_type = (customerOrderCount || 0) > 0 ? 'repeat' : 'new';

  // Determine initial payment_status
  let initial_payment_status = 'unpaid';
  if (payment_type === 'cod') {
    initial_payment_status = 'cod_pending';
  }

  // Insert order
  const orderData = {
    order_number,
    customer_id,
    shipping_address_id: shipping_address_id || null,
    order_source,
    order_type,
    payment_type,
    payment_status: initial_payment_status,
    subtotal,
    shipping_fee: parseFloat(shipping_fee),
    discount: parseFloat(discount),
    total_amount,
    total_paid: 0,
    balance_due: total_amount,
    order_status: 'created',
    fulfilment_type,
    fulfilment_location_id: fulfilment_location_id || null,
    notes: notes || null,
    created_by: userId || null,
  };

  const { data: createdOrder, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (orderError) {
    throw new BadRequestError(`Failed to create order: ${orderError.message}`);
  }

  // Insert order items
  const itemsToInsert = orderItems.map((item) => ({
    ...item,
    order_id: createdOrder.id,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemsToInsert);

  if (itemsError) {
    throw new BadRequestError(`Failed to create order items: ${itemsError.message}`);
  }

  // For COD: auto-create payment record
  if (payment_type === 'cod') {
    const { error: paymentError } = await supabase
      .from('order_payments')
      .insert({
        order_id: createdOrder.id,
        payment_method: 'cod',
        amount: total_amount,
        payment_date: null,
        status: 'pending',
        created_by: userId || null,
      });

    if (paymentError) {
      console.error('Failed to create COD payment record:', paymentError.message);
    }
  }

  // Log status history
  const { error: historyError } = await supabase
    .from('order_status_history')
    .insert({
      order_id: createdOrder.id,
      previous_status: null,
      new_status: 'created',
      source: 'manual',
      notes: 'Order created',
      changed_by: userId || null,
    });

  if (historyError) {
    console.error('Failed to log status history:', historyError.message);
  }

  return getOrderById(createdOrder.id);
};

/**
 * Update an order
 */
const updateOrder = async (id, data) => {
  // Verify order exists
  const { data: existing, error: fetchError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('Order not found');
  }

  const allowedFields = [
    'notes', 'tracking_number', 'courier', 'shipped_date',
    'delivered_date', 'return_reason',
  ];

  const updateData = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new BadRequestError('No valid fields to update');
  }

  const { data: updated, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new BadRequestError(`Failed to update order: ${error.message}`);
  }

  return updated;
};

/**
 * Update order status with transition validation and history logging
 */
const updateOrderStatus = async (id, newStatus, notes, userId) => {
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, order_status')
    .eq('id', id)
    .single();

  if (fetchError || !order) {
    throw new NotFoundError('Order not found');
  }

  const previousStatus = order.order_status;

  if (previousStatus === newStatus) {
    throw new BadRequestError(`Order is already in '${newStatus}' status`);
  }

  // Terminal statuses that cannot transition further (except override)
  const terminalStatuses = ['completed', 'cancelled', 'lost'];
  if (terminalStatuses.includes(previousStatus)) {
    throw new BadRequestError(`Cannot change status from '${previousStatus}'. Order is in a terminal state.`);
  }

  const updateData = { order_status: newStatus };

  // Auto-set dates based on status
  if (newStatus === 'shipped' || newStatus === 'in_transit') {
    updateData.shipped_date = new Date().toISOString().slice(0, 10);
  }
  if (newStatus === 'delivered' || newStatus === 'completed') {
    updateData.delivered_date = new Date().toISOString().slice(0, 10);
  }

  const { data: updated, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new BadRequestError(`Failed to update order status: ${error.message}`);
  }

  // Log status history
  const { error: historyError } = await supabase
    .from('order_status_history')
    .insert({
      order_id: id,
      previous_status: previousStatus,
      new_status: newStatus,
      source: 'manual',
      notes: notes || null,
      changed_by: userId || null,
    });

  if (historyError) {
    console.error('Failed to log status history:', historyError.message);
  }

  return updated;
};

/**
 * Delete an order (only if status is 'created')
 */
const deleteOrder = async (id) => {
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, order_status')
    .eq('id', id)
    .single();

  if (fetchError || !order) {
    throw new NotFoundError('Order not found');
  }

  if (order.order_status !== 'created') {
    throw new BadRequestError('Only orders with status "created" can be deleted');
  }

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id);

  if (error) {
    throw new BadRequestError(`Failed to delete order: ${error.message}`);
  }

  return { message: 'Order deleted successfully' };
};

/**
 * List payments for an order
 */
const listPayments = async (orderId) => {
  // Verify order exists
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    throw new NotFoundError('Order not found');
  }

  const { data, error } = await supabase
    .from('order_payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new BadRequestError(`Failed to fetch payments: ${error.message}`);
  }

  return data;
};

/**
 * Create a payment record for an order
 */
const createPayment = async (orderId, data, userId) => {
  // Verify order exists
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, total_amount, total_paid')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    throw new NotFoundError('Order not found');
  }

  const paymentData = {
    order_id: orderId,
    payment_method: data.payment_method,
    amount: parseFloat(data.amount),
    payment_date: data.payment_date || new Date().toISOString().slice(0, 10),
    status: 'pending',
    payment_proof_url: data.payment_proof_url || null,
    reference_number: data.reference_number || null,
    notes: data.notes || null,
    created_by: userId || null,
  };

  const { data: payment, error } = await supabase
    .from('order_payments')
    .insert(paymentData)
    .select()
    .single();

  if (error) {
    throw new BadRequestError(`Failed to create payment: ${error.message}`);
  }

  return payment;
};

/**
 * Confirm a payment and recalculate order totals
 */
const confirmPayment = async (orderId, paymentId, userId) => {
  // Verify order and payment exist
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, total_amount, total_paid, balance_due')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new NotFoundError('Order not found');
  }

  const { data: payment, error: paymentError } = await supabase
    .from('order_payments')
    .select('*')
    .eq('id', paymentId)
    .eq('order_id', orderId)
    .single();

  if (paymentError || !payment) {
    throw new NotFoundError('Payment not found');
  }

  if (payment.status === 'confirmed') {
    throw new ConflictError('Payment is already confirmed');
  }

  if (payment.status === 'rejected') {
    throw new BadRequestError('Cannot confirm a rejected payment');
  }

  // Update payment status
  const { error: updateError } = await supabase
    .from('order_payments')
    .update({
      status: 'confirmed',
      confirmed_by: userId || null,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) {
    throw new BadRequestError(`Failed to confirm payment: ${updateError.message}`);
  }

  // Recalculate order total_paid, balance_due, payment_status
  const { data: confirmedPayments, error: sumError } = await supabase
    .from('order_payments')
    .select('amount')
    .eq('order_id', orderId)
    .eq('status', 'confirmed');

  if (sumError) {
    throw new BadRequestError(`Failed to recalculate totals: ${sumError.message}`);
  }

  const total_paid = confirmedPayments.reduce((sum, p) => roundMoney(sum + parseFloat(p.amount)), 0);
  const balance_due = roundMoney(parseFloat(order.total_amount) - total_paid);

  let payment_status;
  if (total_paid <= 0) {
    payment_status = 'unpaid';
  } else if (balance_due <= 0) {
    payment_status = 'paid';
  } else {
    payment_status = 'partial';
  }

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({ total_paid, balance_due, payment_status })
    .eq('id', orderId);

  if (orderUpdateError) {
    throw new BadRequestError(`Failed to update order totals: ${orderUpdateError.message}`);
  }

  return { paymentId, total_paid, balance_due, payment_status };
};

/**
 * Reject a payment
 */
const rejectPayment = async (orderId, paymentId, userId) => {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new NotFoundError('Order not found');
  }

  const { data: payment, error: paymentError } = await supabase
    .from('order_payments')
    .select('*')
    .eq('id', paymentId)
    .eq('order_id', orderId)
    .single();

  if (paymentError || !payment) {
    throw new NotFoundError('Payment not found');
  }

  if (payment.status === 'rejected') {
    throw new ConflictError('Payment is already rejected');
  }

  if (payment.status === 'confirmed') {
    throw new BadRequestError('Cannot reject a confirmed payment. Refund instead.');
  }

  const { error: updateError } = await supabase
    .from('order_payments')
    .update({
      status: 'rejected',
      confirmed_by: userId || null,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updateError) {
    throw new BadRequestError(`Failed to reject payment: ${updateError.message}`);
  }

  return { paymentId, status: 'rejected' };
};

module.exports = {
  listOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  listPayments,
  createPayment,
  confirmPayment,
  rejectPayment,
};

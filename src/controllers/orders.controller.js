const ordersService = require('../services/orders.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');
const { storageBuckets, getPublicUrl } = require('../config/storage');
const supabase = require('../config/database');
const { generateFilename } = require('../middleware/upload.middleware');

/**
 * List orders with filters and pagination
 */
const listOrders = async (req, res, next) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || undefined,
      limit: parseInt(req.query.limit) || undefined,
      order_status: req.query.order_status,
      order_source: req.query.order_source,
      payment_status: req.query.payment_status,
      fulfilment_type: req.query.fulfilment_type,
      customer_id: req.query.customer_id,
      source_campaign_id: req.query.source_campaign_id,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      search: req.query.search,
    };

    const result = await ordersService.listOrders(filters);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: result.data,
      pagination: result.pagination,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get order by ID
 */
const getOrderById = async (req, res, next) => {
  try {
    const order = await ordersService.getOrderById(req.params.id);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: order,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new order
 */
const createOrder = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const order = await ordersService.createOrder(req.body, userId);

    res.status(201).json(formatSuccessResponse({
      message: SuccessMessages.CREATED,
      data: order,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Update an order
 */
const updateOrder = async (req, res, next) => {
  try {
    const order = await ordersService.updateOrder(req.params.id, req.body);

    res.json(formatSuccessResponse({
      message: SuccessMessages.UPDATED,
      data: order,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const { order_status, notes } = req.body;
    const order = await ordersService.updateOrderStatus(req.params.id, order_status, notes, userId);

    res.json(formatSuccessResponse({
      message: SuccessMessages.UPDATED,
      data: order,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an order
 */
const deleteOrder = async (req, res, next) => {
  try {
    const result = await ordersService.deleteOrder(req.params.id);

    res.json(formatSuccessResponse({
      message: SuccessMessages.DELETED,
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * List payments for an order
 */
const listPayments = async (req, res, next) => {
  try {
    const payments = await ordersService.listPayments(req.params.id);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: payments,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Create a payment for an order (with optional file upload for payment proof)
 */
const createPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const paymentData = { ...req.body };

    // Handle file upload for payment proof
    if (req.file) {
      const filename = generateFilename(req.file);
      const filePath = `orders/${req.params.id}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(storageBuckets.paymentProofs.name)
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        console.error('Payment proof upload error:', uploadError.message);
      } else {
        paymentData.payment_proof_url = getPublicUrl(storageBuckets.paymentProofs.name, filePath);
      }
    }

    const payment = await ordersService.createPayment(req.params.id, paymentData, userId);

    res.status(201).json(formatSuccessResponse({
      message: SuccessMessages.CREATED,
      data: payment,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm a payment
 */
const confirmPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const result = await ordersService.confirmPayment(req.params.id, req.params.paymentId, userId);

    res.json(formatSuccessResponse({
      message: 'Payment confirmed successfully',
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a payment
 */
const rejectPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const result = await ordersService.rejectPayment(req.params.id, req.params.paymentId, userId);

    res.json(formatSuccessResponse({
      message: 'Payment rejected successfully',
      data: result,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get order status history
 */
const getOrderHistory = async (req, res, next) => {
  try {
    const order = await ordersService.getOrderById(req.params.id);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: order.order_status_history || [],
    }));
  } catch (error) {
    next(error);
  }
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
  getOrderHistory,
};

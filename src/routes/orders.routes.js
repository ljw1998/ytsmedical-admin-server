const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orders.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const { uploadPaymentProof, handleUploadError } = require('../middleware/upload.middleware');
const {
  createOrderValidation,
  updateOrderValidation,
  updateOrderStatusValidation,
  uuidParamValidation,
  createPaymentValidation,
  confirmPaymentValidation,
} = require('../validators/orders.validator');

// All routes require authentication
router.use(authenticate);

// GET / - List orders
router.get(
  '/',
  requirePermission('orders.view'),
  ordersController.listOrders
);

// GET /:id - Get order by ID
router.get(
  '/:id',
  requirePermission('orders.view'),
  uuidParamValidation,
  validate,
  ordersController.getOrderById
);

// POST / - Create order
router.post(
  '/',
  requirePermission('orders.create'),
  createOrderValidation,
  validate,
  ordersController.createOrder
);

// PUT /:id - Update order
router.put(
  '/:id',
  requirePermission('orders.update'),
  updateOrderValidation,
  validate,
  ordersController.updateOrder
);

// PUT /:id/status - Update order status
router.put(
  '/:id/status',
  requireAnyPermission(['orders.update', 'orders.override_status']),
  updateOrderStatusValidation,
  validate,
  ordersController.updateOrderStatus
);

// DELETE /:id - Delete order
router.delete(
  '/:id',
  requirePermission('orders.delete'),
  uuidParamValidation,
  validate,
  ordersController.deleteOrder
);

// GET /:id/payments - List payments for an order
router.get(
  '/:id/payments',
  requirePermission('payments.view'),
  uuidParamValidation,
  validate,
  ordersController.listPayments
);

// POST /:id/payments - Create payment (with optional payment proof upload)
router.post(
  '/:id/payments',
  requirePermission('payments.create'),
  uploadPaymentProof(),
  handleUploadError,
  createPaymentValidation,
  validate,
  ordersController.createPayment
);

// PUT /:id/payments/:paymentId/confirm - Confirm payment
router.put(
  '/:id/payments/:paymentId/confirm',
  requirePermission('payments.confirm'),
  confirmPaymentValidation,
  validate,
  ordersController.confirmPayment
);

// PUT /:id/payments/:paymentId/reject - Reject payment
router.put(
  '/:id/payments/:paymentId/reject',
  requirePermission('payments.confirm'),
  confirmPaymentValidation,
  validate,
  ordersController.rejectPayment
);

// GET /:id/history - Get order status history
router.get(
  '/:id/history',
  requirePermission('orders.view'),
  uuidParamValidation,
  validate,
  ordersController.getOrderHistory
);

module.exports = router;

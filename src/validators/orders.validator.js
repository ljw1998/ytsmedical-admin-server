const { body, param } = require('express-validator');
const {
  ORDER_STATUSES,
  ORDER_SOURCES,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  FULFILMENT_TYPES
} = require('../config/constants');

const uuidParamValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];

const createOrderValidation = [
  body('customer_id')
    .notEmpty()
    .withMessage('Customer ID is required')
    .isUUID()
    .withMessage('Customer ID must be a valid UUID'),
  body('order_source')
    .notEmpty()
    .withMessage('Order source is required')
    .isIn(ORDER_SOURCES)
    .withMessage(`Order source must be one of: ${ORDER_SOURCES.join(', ')}`),
  body('payment_type')
    .notEmpty()
    .withMessage('Payment type is required')
    .isIn(PAYMENT_TYPES)
    .withMessage(`Payment type must be one of: ${PAYMENT_TYPES.join(', ')}`),
  body('fulfilment_type')
    .notEmpty()
    .withMessage('Fulfilment type is required')
    .isIn(FULFILMENT_TYPES)
    .withMessage(`Fulfilment type must be one of: ${FULFILMENT_TYPES.join(', ')}`),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items array is required and must have at least one item'),
  body('items.*.item_type')
    .notEmpty()
    .withMessage('Item type is required')
    .isIn(['product', 'bundle'])
    .withMessage('Item type must be product or bundle'),
  body('items.*.item_id')
    .notEmpty()
    .withMessage('Item ID is required')
    .isUUID()
    .withMessage('Item ID must be a valid UUID'),
  body('items.*.quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be an integer greater than 0'),
  body('shipping_address_id')
    .optional()
    .isUUID()
    .withMessage('Shipping address ID must be a valid UUID'),
  body('fulfilment_location_id')
    .optional()
    .isUUID()
    .withMessage('Fulfilment location ID must be a valid UUID'),
  body('shipping_fee')
    .optional()
    .isNumeric()
    .withMessage('Shipping fee must be a number'),
  body('discount')
    .optional()
    .isNumeric()
    .withMessage('Discount must be a number'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters'),
];

const updateOrderValidation = [
  ...uuidParamValidation,
  body('order_status')
    .optional()
    .isIn(ORDER_STATUSES)
    .withMessage(`Order status must be one of: ${ORDER_STATUSES.join(', ')}`),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters'),
  body('tracking_number')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Tracking number must not exceed 255 characters'),
  body('courier')
    .optional()
    .isIn(['ninjavan', 'other'])
    .withMessage('Courier must be ninjavan or other'),
  body('shipped_date')
    .optional()
    .isISO8601()
    .withMessage('Shipped date must be a valid date'),
  body('delivered_date')
    .optional()
    .isISO8601()
    .withMessage('Delivered date must be a valid date'),
  body('return_reason')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Return reason must not exceed 1000 characters'),
];

const updateOrderStatusValidation = [
  ...uuidParamValidation,
  body('order_status')
    .notEmpty()
    .withMessage('Order status is required')
    .isIn(ORDER_STATUSES)
    .withMessage(`Order status must be one of: ${ORDER_STATUSES.join(', ')}`),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters'),
];

const createPaymentValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid order ID format'),
  body('payment_method')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(PAYMENT_METHODS)
    .withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a number greater than 0'),
  body('payment_date')
    .optional()
    .isISO8601()
    .withMessage('Payment date must be a valid date'),
  body('reference_number')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Reference number must not exceed 255 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters'),
];

const confirmPaymentValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid order ID format'),
  param('paymentId')
    .isUUID()
    .withMessage('Invalid payment ID format'),
];

module.exports = {
  createOrderValidation,
  updateOrderValidation,
  updateOrderStatusValidation,
  uuidParamValidation,
  createPaymentValidation,
  confirmPaymentValidation,
};

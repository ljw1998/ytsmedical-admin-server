const { body, param } = require('express-validator');

const uuidParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];

const locationIdParam = [
  param('locationId')
    .isUUID()
    .withMessage('Invalid location ID format'),
];

const productIdParam = [
  param('productId')
    .isUUID()
    .withMessage('Invalid product ID format'),
];

const adjustStockValidation = [
  body('location_id')
    .notEmpty()
    .withMessage('Location ID is required')
    .isUUID()
    .withMessage('Invalid location ID format'),
  body('product_id')
    .notEmpty()
    .withMessage('Product ID is required')
    .isUUID()
    .withMessage('Invalid product ID format'),
  body('movement_type')
    .notEmpty()
    .withMessage('Movement type is required')
    .isIn(['stock_in', 'stock_out', 'transfer_out', 'transfer_in', 'adjustment', 'return', 'bundle_sale', 'shopee_sale', 'agent_sale'])
    .withMessage('Movement type must be stock_in, stock_out, transfer_out, transfer_in, adjustment, return, bundle_sale, shopee_sale, or agent_sale'),
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt()
    .withMessage('Quantity must be an integer'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
];

const createTransferValidation = [
  body('from_location_id')
    .notEmpty()
    .withMessage('From location ID is required')
    .isUUID()
    .withMessage('Invalid from location ID format'),
  body('to_location_id')
    .notEmpty()
    .withMessage('To location ID is required')
    .isUUID()
    .withMessage('Invalid to location ID format'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items array is required and must have at least one item'),
  body('items.*.product_id')
    .isUUID()
    .withMessage('Each item must have a valid product ID'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Each item quantity must be a positive integer'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
];

module.exports = {
  uuidParam,
  locationIdParam,
  productIdParam,
  adjustStockValidation,
  createTransferValidation,
};

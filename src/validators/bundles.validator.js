const { body, param } = require('express-validator');

const uuidParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid bundle ID format'),
];

const create = [
  body('bundle_name')
    .trim()
    .notEmpty()
    .withMessage('Bundle name is required')
    .isLength({ max: 255 })
    .withMessage('Bundle name must not exceed 255 characters'),
  body('bundle_sku')
    .trim()
    .notEmpty()
    .withMessage('Bundle SKU is required')
    .isLength({ max: 100 })
    .withMessage('Bundle SKU must not exceed 100 characters'),
  body('bundle_price')
    .notEmpty()
    .withMessage('Bundle price is required')
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Bundle price must be a valid decimal with up to 2 decimal places'),
  body('bundle_cost')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Bundle cost must be a valid decimal with up to 2 decimal places'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items array is required and must have at least one item'),
  body('items.*.product_id')
    .isUUID()
    .withMessage('Each item must have a valid product ID'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Each item quantity must be a positive integer'),
];

const update = [
  ...uuidParam,
  body('bundle_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Bundle name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Bundle name must not exceed 255 characters'),
  body('bundle_sku')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Bundle SKU cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Bundle SKU must not exceed 100 characters'),
  body('bundle_price')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Bundle price must be a valid decimal with up to 2 decimal places'),
  body('bundle_cost')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Bundle cost must be a valid decimal with up to 2 decimal places'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
  body('items')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Items array must have at least one item'),
  body('items.*.product_id')
    .optional()
    .isUUID()
    .withMessage('Each item must have a valid product ID'),
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each item quantity must be a positive integer'),
];

module.exports = {
  create,
  update,
  uuidParam,
};

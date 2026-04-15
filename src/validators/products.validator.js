const { body, param } = require('express-validator');

const uuidParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid product ID format'),
];

const create = [
  body('product_name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 255 })
    .withMessage('Product name must not exceed 255 characters'),
  body('sku')
    .trim()
    .notEmpty()
    .withMessage('SKU is required')
    .isLength({ max: 100 })
    .withMessage('SKU must not exceed 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('category_id')
    .optional()
    .isUUID()
    .withMessage('Invalid category ID format'),
  body('unit_price')
    .notEmpty()
    .withMessage('Unit price is required')
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Unit price must be a valid decimal with up to 2 decimal places'),
  body('cost_price')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Cost price must be a valid decimal with up to 2 decimal places'),
  body('weight')
    .optional()
    .isDecimal({ decimal_digits: '0,3' })
    .withMessage('Weight must be a valid decimal with up to 3 decimal places'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'discontinued'])
    .withMessage('Status must be active, inactive, or discontinued'),
];

const update = [
  ...uuidParam,
  body('product_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Product name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Product name must not exceed 255 characters'),
  body('sku')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('SKU cannot be empty')
    .isLength({ max: 100 })
    .withMessage('SKU must not exceed 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('category_id')
    .optional()
    .isUUID()
    .withMessage('Invalid category ID format'),
  body('unit_price')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Unit price must be a valid decimal with up to 2 decimal places'),
  body('cost_price')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Cost price must be a valid decimal with up to 2 decimal places'),
  body('weight')
    .optional()
    .isDecimal({ decimal_digits: '0,3' })
    .withMessage('Weight must be a valid decimal with up to 3 decimal places'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'discontinued'])
    .withMessage('Status must be active, inactive, or discontinued'),
];

module.exports = {
  create,
  update,
  uuidParam,
};

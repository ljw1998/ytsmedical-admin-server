const { body, param } = require('express-validator');

const uuidParamValidation = [
  param('agentId')
    .isUUID()
    .withMessage('Invalid agent ID format'),
];

const recordSaleValidation = [
  body('agent_id')
    .notEmpty()
    .withMessage('Agent ID is required')
    .isUUID()
    .withMessage('Agent ID must be a valid UUID'),
  body('sale_date')
    .notEmpty()
    .withMessage('Sale date is required')
    .isISO8601()
    .withMessage('Sale date must be a valid date'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items array is required and must have at least one item'),
  body('items.*.product_id')
    .notEmpty()
    .withMessage('Product ID is required')
    .isUUID()
    .withMessage('Product ID must be a valid UUID'),
  body('items.*.quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be an integer greater than 0'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must not exceed 2000 characters'),
];

const allocateStockValidation = [
  body('agent_id')
    .notEmpty()
    .withMessage('Agent ID is required')
    .isUUID()
    .withMessage('Agent ID must be a valid UUID'),
  body('location_id')
    .notEmpty()
    .withMessage('Location ID is required')
    .isUUID()
    .withMessage('Location ID must be a valid UUID'),
  body('product_id')
    .notEmpty()
    .withMessage('Product ID is required')
    .isUUID()
    .withMessage('Product ID must be a valid UUID'),
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be an integer greater than 0'),
];

module.exports = {
  uuidParamValidation,
  recordSaleValidation,
  allocateStockValidation,
};

const { body, param } = require('express-validator');

const uuidParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid category ID format'),
];

const create = [
  body('category_name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ max: 255 })
    .withMessage('Category name must not exceed 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
];

const update = [
  ...uuidParam,
  body('category_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Category name must not exceed 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
];

module.exports = {
  create,
  update,
  uuidParam,
};

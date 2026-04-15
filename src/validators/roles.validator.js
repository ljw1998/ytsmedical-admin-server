const { body, param } = require('express-validator');

const uuidParamValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];

const createRoleValidation = [
  body('role_name')
    .notEmpty()
    .withMessage('Role name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Role name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
];

const updateRoleValidation = [
  ...uuidParamValidation,
  body('role_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Role name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
];

const assignPermissionsValidation = [
  ...uuidParamValidation,
  body('permission_ids')
    .isArray({ min: 1 })
    .withMessage('Permission IDs array is required and must have at least one item'),
  body('permission_ids.*')
    .isUUID()
    .withMessage('Each permission ID must be a valid UUID'),
];

module.exports = {
  uuidParamValidation,
  createRoleValidation,
  updateRoleValidation,
  assignPermissionsValidation,
};

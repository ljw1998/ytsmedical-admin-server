const { body, param } = require('express-validator');

const uuidParamValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];

const createUserValidation = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('full_name')
    .notEmpty()
    .withMessage('Full name is required')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Full name must be between 1 and 255 characters'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone must not exceed 20 characters'),
  body('role_ids')
    .optional()
    .isArray()
    .withMessage('Role IDs must be an array'),
  body('role_ids.*')
    .optional()
    .isUUID()
    .withMessage('Each role ID must be a valid UUID'),
];

const updateUserValidation = [
  ...uuidParamValidation,
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Full name must be between 1 and 255 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone must not exceed 20 characters'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

const assignRolesValidation = [
  ...uuidParamValidation,
  body('role_ids')
    .isArray({ min: 1 })
    .withMessage('Role IDs array is required and must have at least one item'),
  body('role_ids.*')
    .isUUID()
    .withMessage('Each role ID must be a valid UUID'),
];

module.exports = {
  uuidParamValidation,
  createUserValidation,
  updateUserValidation,
  assignRolesValidation,
};

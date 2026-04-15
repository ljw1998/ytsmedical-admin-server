const { body, param } = require('express-validator');

const uuidParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];

const createAdAccountValidation = [
  body('client_name')
    .trim()
    .notEmpty()
    .withMessage('Client name is required')
    .isLength({ max: 255 })
    .withMessage('Client name must not exceed 255 characters'),
  body('ad_account_id')
    .trim()
    .notEmpty()
    .withMessage('Ad account ID is required')
    .isLength({ max: 255 })
    .withMessage('Ad account ID must not exceed 255 characters'),
  body('ad_account_name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Ad account name must not exceed 255 characters'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

const updateAdAccountValidation = [
  ...uuidParam,
  body('client_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Client name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Client name must not exceed 255 characters'),
  body('ad_account_id')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Ad account ID cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Ad account ID must not exceed 255 characters'),
  body('ad_account_name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Ad account name must not exceed 255 characters'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

const manualSyncValidation = [
  body('ad_account_id')
    .trim()
    .notEmpty()
    .withMessage('Ad account ID is required'),
  body('since')
    .notEmpty()
    .withMessage('Since date is required')
    .isDate()
    .withMessage('Since must be a valid date (YYYY-MM-DD)'),
  body('until')
    .notEmpty()
    .withMessage('Until date is required')
    .isDate()
    .withMessage('Until must be a valid date (YYYY-MM-DD)'),
];

module.exports = {
  createAdAccountValidation,
  updateAdAccountValidation,
  manualSyncValidation,
  uuidParam,
};

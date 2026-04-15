const { body, param } = require('express-validator');

const uuidParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid campaign ID format'),
];

const create = [
  body('campaign_name')
    .trim()
    .notEmpty()
    .withMessage('Campaign name is required')
    .isLength({ max: 255 })
    .withMessage('Campaign name must not exceed 255 characters'),
  body('meta_campaign_id')
    .optional()
    .trim()
    .isString()
    .withMessage('Meta campaign ID must be a string')
    .isLength({ max: 255 })
    .withMessage('Meta campaign ID must not exceed 255 characters'),
  body('platform')
    .optional({ values: 'null' })
    .isIn(['facebook', 'instagram'])
    .withMessage('Platform must be facebook or instagram'),
  body('objective')
    .optional({ values: 'null' })
    .isIn(['messaging', 'engagement', 'traffic', 'other'])
    .withMessage('Objective must be messaging, engagement, traffic, or other'),
  body('start_date')
    .optional()
    .isDate()
    .withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  body('end_date')
    .optional()
    .isDate()
    .withMessage('End date must be a valid date (YYYY-MM-DD)'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'archived'])
    .withMessage('Status must be active, inactive, or archived'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Notes must not exceed 5000 characters'),
];

const update = [
  ...uuidParam,
  body('campaign_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Campaign name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Campaign name must not exceed 255 characters'),
  body('meta_campaign_id')
    .optional()
    .trim()
    .isString()
    .withMessage('Meta campaign ID must be a string')
    .isLength({ max: 255 })
    .withMessage('Meta campaign ID must not exceed 255 characters'),
  body('platform')
    .optional({ values: 'null' })
    .isIn(['facebook', 'instagram'])
    .withMessage('Platform must be facebook or instagram'),
  body('objective')
    .optional({ values: 'null' })
    .isIn(['messaging', 'engagement', 'traffic', 'other'])
    .withMessage('Objective must be messaging, engagement, traffic, or other'),
  body('start_date')
    .optional()
    .isDate()
    .withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  body('end_date')
    .optional()
    .isDate()
    .withMessage('End date must be a valid date (YYYY-MM-DD)'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'archived'])
    .withMessage('Status must be active, inactive, or archived'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Notes must not exceed 5000 characters'),
];

module.exports = {
  create,
  update,
  uuidParam,
};

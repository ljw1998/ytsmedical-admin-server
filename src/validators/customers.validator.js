const { body, param, query } = require('express-validator');

const SOURCE_CHANNELS = ['facebook_ad', 'whatsapp', 'shopee', 'agent', 'other'];

const createCustomerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 255 })
    .withMessage('Name must not exceed 255 characters'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: 50 })
    .withMessage('Phone must not exceed 50 characters'),

  body('source_channel')
    .trim()
    .notEmpty()
    .withMessage('Source channel is required')
    .isIn(SOURCE_CHANNELS)
    .withMessage(`Source channel must be one of: ${SOURCE_CHANNELS.join(', ')}`),

  body('messenger_id')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Messenger ID must not exceed 255 characters'),

  body('email')
    .optional({ nullable: true })
    .trim()
    .isEmail()
    .withMessage('Invalid email format'),

  body('source_campaign_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('Source campaign ID must be a valid UUID'),

  body('tags')
    .optional({ nullable: true })
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string'),

  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Notes must not exceed 5000 characters'),
];

const updateCustomerValidation = [
  param('id')
    .isUUID()
    .withMessage('Customer ID must be a valid UUID'),

  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Name must not exceed 255 characters'),

  body('phone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Phone cannot be empty')
    .isLength({ max: 50 })
    .withMessage('Phone must not exceed 50 characters'),

  body('source_channel')
    .optional()
    .trim()
    .isIn(SOURCE_CHANNELS)
    .withMessage(`Source channel must be one of: ${SOURCE_CHANNELS.join(', ')}`),

  body('messenger_id')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Messenger ID must not exceed 255 characters'),

  body('email')
    .optional({ nullable: true })
    .trim()
    .isEmail()
    .withMessage('Invalid email format'),

  body('source_campaign_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('Source campaign ID must be a valid UUID'),

  body('tags')
    .optional({ nullable: true })
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string'),

  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Notes must not exceed 5000 characters'),
];

const uuidParamValidation = [
  param('id')
    .isUUID()
    .withMessage('ID must be a valid UUID'),
];

const createAddressValidation = [
  param('id')
    .isUUID()
    .withMessage('Customer ID must be a valid UUID'),

  body('label')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Label must not exceed 100 characters'),

  body('address_line_1')
    .trim()
    .notEmpty()
    .withMessage('Address line 1 is required')
    .isLength({ max: 500 })
    .withMessage('Address line 1 must not exceed 500 characters'),

  body('address_line_2')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address line 2 must not exceed 500 characters'),

  body('area')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Area must not exceed 255 characters'),

  body('city')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('City must not exceed 255 characters'),

  body('state')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('State must not exceed 255 characters'),

  body('postcode')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postcode must not exceed 20 characters'),

  body('is_default')
    .optional()
    .isBoolean()
    .withMessage('is_default must be a boolean'),
];

const updateAddressValidation = [
  param('id')
    .isUUID()
    .withMessage('Customer ID must be a valid UUID'),

  param('addressId')
    .isUUID()
    .withMessage('Address ID must be a valid UUID'),

  body('label')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Label must not exceed 100 characters'),

  body('address_line_1')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Address line 1 cannot be empty')
    .isLength({ max: 500 })
    .withMessage('Address line 1 must not exceed 500 characters'),

  body('address_line_2')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address line 2 must not exceed 500 characters'),

  body('area')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Area must not exceed 255 characters'),

  body('city')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('City must not exceed 255 characters'),

  body('state')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('State must not exceed 255 characters'),

  body('postcode')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postcode must not exceed 20 characters'),

  body('is_default')
    .optional()
    .isBoolean()
    .withMessage('is_default must be a boolean'),
];

module.exports = {
  createCustomerValidation,
  updateCustomerValidation,
  uuidParamValidation,
  createAddressValidation,
  updateAddressValidation,
};

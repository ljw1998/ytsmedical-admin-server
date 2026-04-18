const { body, param } = require('express-validator');

const uuidParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid storage location ID format'),
];

const create = [
  body('location_name')
    .trim()
    .notEmpty()
    .withMessage('Location name is required')
    .isLength({ max: 255 })
    .withMessage('Location name must not exceed 255 characters'),
  body('location_type')
    .trim()
    .notEmpty()
    .withMessage('Location type is required')
    .isIn(['own_warehouse', 'fulfilment_centre', 'agent'])
    .withMessage('Location type must be own_warehouse, fulfilment_centre, or agent'),
  body('address_line_1')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address line 1 must not exceed 500 characters'),
  body('address_line_2')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address line 2 must not exceed 500 characters'),
  body('area')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Area must not exceed 255 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('City must not exceed 255 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('State must not exceed 255 characters'),
  body('postcode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postcode must not exceed 20 characters'),
  body('contact_person')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Contact person must not exceed 255 characters'),
  body('contact_phone')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Contact phone must not exceed 50 characters'),
  body('contact_email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Contact email must be a valid email address'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive'),
];

const update = [
  ...uuidParam,
  body('location_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Location name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Location name must not exceed 255 characters'),
  body('location_type')
    .optional()
    .isIn(['own_warehouse', 'fulfilment_centre', 'agent'])
    .withMessage('Location type must be own_warehouse, fulfilment_centre, or agent'),
  body('address_line_1')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address line 1 must not exceed 500 characters'),
  body('address_line_2')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address line 2 must not exceed 500 characters'),
  body('area')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Area must not exceed 255 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('City must not exceed 255 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('State must not exceed 255 characters'),
  body('postcode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postcode must not exceed 20 characters'),
  body('contact_person')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Contact person must not exceed 255 characters'),
  body('contact_phone')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Contact phone must not exceed 50 characters'),
  body('contact_email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Contact email must be a valid email address'),
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

const { param } = require('express-validator');

const uuidParamValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];

const confirmImportValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid import ID format'),
];

module.exports = {
  uuidParamValidation,
  confirmImportValidation,
};

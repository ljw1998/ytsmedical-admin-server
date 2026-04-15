const { param } = require('express-validator');

const uuidParamValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];

module.exports = {
  uuidParamValidation,
};

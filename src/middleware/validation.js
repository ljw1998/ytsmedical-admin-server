const { validationResult } = require('express-validator');
const { formatErrorResponse, ErrorCodes } = require('../utils/helpers');

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    const errorResponse = formatErrorResponse({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      details: formattedErrors
    });

    return res.status(400).json(errorResponse);
  }

  next();
};

module.exports = validate;

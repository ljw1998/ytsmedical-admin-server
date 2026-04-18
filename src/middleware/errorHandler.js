const { formatErrorResponse, ErrorCodes } = require('../utils/helpers');

const errorNameToCode = {
  'ValidationError': ErrorCodes.VALIDATION_ERROR,
  'UnauthorizedError': ErrorCodes.UNAUTHORIZED,
  'ForbiddenError': ErrorCodes.FORBIDDEN,
  'NotFoundError': ErrorCodes.NOT_FOUND,
  'ConflictError': ErrorCodes.CONFLICT,
  'BadRequestError': ErrorCodes.INVALID_INPUT,
  'JsonWebTokenError': ErrorCodes.INVALID_TOKEN,
  'TokenExpiredError': ErrorCodes.TOKEN_EXPIRED,
};

const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    name: err.name,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  let statusCode = parseInt(err.statusCode, 10);
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
  }

  const errorCode = errorNameToCode[err.name] || ErrorCodes.INTERNAL_ERROR;

  let details = null;

  if (err.errors) {
    details = err.errors;
  }

  if (process.env.NODE_ENV === 'development' && err.stack) {
    details = details || {};
    if (Array.isArray(details)) {
      details = { validationErrors: details, stack: err.stack };
    } else {
      details.stack = err.stack;
    }
  }

  const errorResponse = formatErrorResponse({
    code: errorCode,
    message: err.message || 'Internal server error',
    details
  });

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;

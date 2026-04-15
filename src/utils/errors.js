class AppError extends Error {
  constructor(message, statusCode = 500, name = 'Error', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.name = name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = null) {
    super(message, 400, 'ValidationError');
    this.errors = errors;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UnauthorizedError');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'ForbiddenError');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NotFoundError');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'ConflictError');
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BadRequestError');
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
};

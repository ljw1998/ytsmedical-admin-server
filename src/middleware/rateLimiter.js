const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    error: 'TooManyRequestsError',
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'TooManyRequestsError',
    message: 'Too many login attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'TooManyRequestsError',
    message: 'Too many password reset requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: 'TooManyRequestsError',
    message: 'Too many refresh requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  message: {
    success: false,
    error: 'TooManyRequestsError',
    message: 'Too many webhook requests'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  loginLimiter,
  passwordResetLimiter,
  refreshLimiter,
  webhookLimiter
};

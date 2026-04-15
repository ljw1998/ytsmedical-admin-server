const { body } = require('express-validator');

const loginValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail({ gmail_remove_dots: false })
    .toLowerCase(),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required'),
];

const logoutValidation = [
  body('refreshToken')
    .optional(),
];

const forgotPasswordValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail({ gmail_remove_dots: false })
    .toLowerCase(),
];

const resetPasswordValidation = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
];

const updateProfileValidation = [
  body('full_name')
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
    .trim(),
];

module.exports = {
  loginValidation,
  refreshTokenValidation,
  logoutValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
};

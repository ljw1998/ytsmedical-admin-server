const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validation');
const {
  loginLimiter,
  passwordResetLimiter,
  refreshLimiter
} = require('../middleware/rateLimiter');
const {
  loginValidation,
  refreshTokenValidation,
  logoutValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation
} = require('../validators/auth.validator');

// Public routes
router.post(
  '/login',
  loginLimiter,
  loginValidation,
  validate,
  authController.login
);

router.post(
  '/refresh',
  refreshLimiter,
  refreshTokenValidation,
  validate,
  authController.refreshToken
);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  forgotPasswordValidation,
  validate,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  passwordResetLimiter,
  resetPasswordValidation,
  validate,
  authController.resetPassword
);

// Protected routes (require authentication)
router.post(
  '/logout',
  authenticate,
  logoutValidation,
  validate,
  authController.logout
);

router.get(
  '/me',
  authenticate,
  authController.getProfile
);

router.put(
  '/me',
  authenticate,
  updateProfileValidation,
  validate,
  authController.updateProfile
);

router.put(
  '/change-password',
  authenticate,
  changePasswordValidation,
  validate,
  authController.changePassword
);

module.exports = router;

const authService = require('../services/auth.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

class AuthController {
  /**
   * POST /api/admin/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.status(200).json(formatSuccessResponse({
        message: SuccessMessages.LOGIN_SUCCESS,
        data: result
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/auth/refresh
   */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);

      res.status(200).json(formatSuccessResponse({
        message: 'Token refreshed successfully',
        data: result
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/auth/logout
   */
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(req.user.id, refreshToken);

      res.status(200).json(formatSuccessResponse({
        message: SuccessMessages.LOGOUT_SUCCESS
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/auth/me
   */
  async getProfile(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user.id);

      res.status(200).json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data: profile
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/auth/me
   */
  async updateProfile(req, res, next) {
    try {
      const updates = req.body;
      const profile = await authService.updateProfile(req.user.id, updates);

      res.status(200).json(formatSuccessResponse({
        message: 'Profile updated successfully',
        data: profile
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user.id, currentPassword, newPassword);

      res.status(200).json(formatSuccessResponse({
        message: SuccessMessages.PASSWORD_CHANGED
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);

      // Always return success to prevent email enumeration
      res.status(200).json(formatSuccessResponse({
        message: SuccessMessages.PASSWORD_RESET_SENT
      }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);

      res.status(200).json(formatSuccessResponse({
        message: SuccessMessages.PASSWORD_RESET_SUCCESS
      }));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();

const bcrypt = require('bcrypt');
const supabase = require('../config/database');
const { sendEmail } = require('../config/email');
const { PASSWORD_RESET_EXPIRY_HOURS, ERROR_MESSAGES } = require('../config/constants');
const { generateTokens, verifyRefreshToken, getAccessTokenExpirySeconds } = require('../utils/jwt');
const { generateRandomToken, hashToken, calculateExpiry, sanitizeUser } = require('../utils/helpers');
const { UnauthorizedError, BadRequestError, NotFoundError } = require('../utils/errors');

class AuthService {
  /**
   * Get admin user with permissions and roles
   * Queries admin_users for user details + v_admin_user_permissions view for permissions/roles
   */
  async getAdminUserWithPermissions(userId) {
    // Fetch user details (including is_active) from admin_users table
    const { data: adminUser, error: userError } = await supabase
      .from('admin_users')
      .select('id, email, full_name, is_active')
      .eq('id', userId)
      .single();

    if (userError || !adminUser) {
      return null;
    }

    // Fetch permissions and roles from view
    const { data: permData } = await supabase
      .from('v_admin_user_permissions')
      .select('*')
      .eq('admin_user_id', userId)
      .single();

    return {
      id: adminUser.id,
      email: adminUser.email,
      full_name: adminUser.full_name,
      fullName: adminUser.full_name,
      is_active: adminUser.is_active,
      isActive: adminUser.is_active,
      permissions: permData?.permissions || [],
      roles: permData?.roles || []
    };
  }

  /**
   * Login admin user with email and password
   */
  async login(email, password) {
    // Find admin user by email
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !adminUser) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    // Check if account is active
    if (!adminUser.is_active) {
      throw new UnauthorizedError(ERROR_MESSAGES.ACCOUNT_DISABLED);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, adminUser.password_hash);
    if (!isValidPassword) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    // Fetch permissions and roles
    const userWithPermissions = await this.getAdminUserWithPermissions(adminUser.id);

    if (!userWithPermissions) {
      throw new UnauthorizedError('Unable to load user permissions');
    }

    // Update last_login_at
    await supabase
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', adminUser.id);

    // Generate tokens (with permissions/roles embedded in access token)
    const { accessToken, refreshToken } = generateTokens(userWithPermissions);

    // Hash and store refresh token
    const hashedRefreshToken = hashToken(refreshToken);
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days

    await supabase.from('admin_refresh_tokens').insert({
      admin_user_id: adminUser.id,
      token: hashedRefreshToken,
      expires_at: refreshTokenExpiry.toISOString()
    });

    console.log(`Admin user logged in: ${adminUser.email}`);

    // In development mode, also return the simple token (admin user ID)
    const isDev = process.env.NODE_ENV === 'development';

    return {
      user: {
        id: adminUser.id,
        email: adminUser.email,
        full_name: adminUser.full_name,
        is_active: adminUser.is_active,
        last_login_at: adminUser.last_login_at,
        permissions: userWithPermissions.permissions,
        roles: userWithPermissions.roles
      },
      accessToken,
      refreshToken,
      expiresIn: getAccessTokenExpirySeconds(),
      ...(isDev && { devToken: adminUser.id })
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken) {
    // Verify the refresh token JWT
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    // Hash the token to look up in database
    const hashedToken = hashToken(refreshToken);

    // Find the token in database
    const { data: tokenRecord, error } = await supabase
      .from('admin_refresh_tokens')
      .select('*')
      .eq('token', hashedToken)
      .single();

    if (error || !tokenRecord) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    // Fetch admin user with fresh permissions
    const userWithPermissions = await this.getAdminUserWithPermissions(tokenRecord.admin_user_id);

    if (!userWithPermissions) {
      throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Check if admin is still active
    if (!userWithPermissions.is_active) {
      throw new UnauthorizedError(ERROR_MESSAGES.ACCOUNT_DISABLED);
    }

    // Delete the old refresh token
    await supabase
      .from('admin_refresh_tokens')
      .delete()
      .eq('id', tokenRecord.id);

    // Generate new tokens with fresh permissions
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(userWithPermissions);

    // Store new refresh token
    const hashedNewToken = hashToken(newRefreshToken);
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);

    await supabase.from('admin_refresh_tokens').insert({
      admin_user_id: tokenRecord.admin_user_id,
      token: hashedNewToken,
      expires_at: newExpiry.toISOString()
    });

    console.log(`Token refreshed for admin: ${userWithPermissions.email}`);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: getAccessTokenExpirySeconds(),
      user: {
        id: userWithPermissions.id,
        email: userWithPermissions.email,
        full_name: userWithPermissions.full_name,
        permissions: userWithPermissions.permissions,
        roles: userWithPermissions.roles
      }
    };
  }

  /**
   * Logout - delete refresh token
   */
  async logout(adminUserId, refreshToken) {
    if (refreshToken) {
      const hashedToken = hashToken(refreshToken);

      const { error } = await supabase
        .from('admin_refresh_tokens')
        .delete()
        .eq('admin_user_id', adminUserId)
        .eq('token', hashedToken);

      if (error) {
        console.error('Error deleting refresh token:', error);
      }
    }

    console.log(`Admin user logged out: ${adminUserId}`);
  }

  /**
   * Get current admin user profile with permissions
   */
  async getProfile(adminUserId) {
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('id, email, full_name, phone, avatar_url, is_active, last_login_at, created_at, updated_at')
      .eq('id', adminUserId)
      .single();

    if (error || !adminUser) {
      throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Fetch permissions and roles
    const userWithPermissions = await this.getAdminUserWithPermissions(adminUserId);

    return {
      ...adminUser,
      permissions: userWithPermissions ? userWithPermissions.permissions : [],
      roles: userWithPermissions ? userWithPermissions.roles : []
    };
  }

  /**
   * Update admin user profile (own profile)
   */
  async updateProfile(adminUserId, updates) {
    const allowedUpdates = {};
    if (updates.full_name) allowedUpdates.full_name = updates.full_name;

    if (Object.keys(allowedUpdates).length === 0) {
      throw new BadRequestError('No valid fields to update');
    }

    allowedUpdates.updated_at = new Date().toISOString();

    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .update(allowedUpdates)
      .eq('id', adminUserId)
      .select('id, email, full_name, phone, avatar_url, is_active, last_login_at, created_at, updated_at')
      .single();

    if (error) {
      throw new Error('Failed to update profile');
    }

    console.log(`Profile updated for admin: ${adminUserId}`);

    return adminUser;
  }

  /**
   * Change password while logged in
   */
  async changePassword(adminUserId, currentPassword, newPassword) {
    // Get current admin user
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', adminUserId)
      .single();

    if (error || !adminUser) {
      throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, adminUser.password_hash);
    if (!isValidPassword) {
      throw new BadRequestError('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', adminUserId);

    if (updateError) {
      throw new Error('Failed to change password');
    }

    // Revoke all refresh tokens for this user (force re-login)
    await supabase
      .from('admin_refresh_tokens')
      .delete()
      .eq('admin_user_id', adminUserId);

    console.log(`Password changed for admin: ${adminUserId}`);
  }

  /**
   * Request password reset - sends email with reset link
   */
  async forgotPassword(email) {
    // Find admin user (don't reveal if email exists)
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, email, full_name')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    // Always return success to prevent email enumeration
    if (!adminUser) {
      console.log(`Password reset requested for non-existent admin email: ${email}`);
      return;
    }

    // Invalidate any existing reset tokens
    await supabase
      .from('admin_password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('admin_user_id', adminUser.id)
      .is('used_at', null);

    // Generate reset token
    const resetToken = generateRandomToken();
    const hashedToken = hashToken(resetToken);
    const expiresAt = calculateExpiry(PASSWORD_RESET_EXPIRY_HOURS);

    // Store reset token
    await supabase.from('admin_password_resets').insert({
      admin_user_id: adminUser.id,
      token: hashedToken,
      expires_at: expiresAt.toISOString()
    });

    // Send reset email
    const resetUrl = `${process.env.PASSWORD_RESET_URL}?token=${resetToken}`;

    const emailHtml = `
      <h2>Password Reset Request</h2>
      <p>Hi ${adminUser.full_name},</p>
      <p>You requested to reset your password for the Wilson Admin Portal.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in ${PASSWORD_RESET_EXPIRY_HOURS} hour(s).</p>
      <p>If you didn't request this, please ignore this email.</p>
      <br>
      <p>Best regards,<br>Wilson Admin Team</p>
    `;

    const emailText = `
      Password Reset Request

      Hi ${adminUser.full_name},

      You requested to reset your password for the Wilson Admin Portal.

      Click the link below to reset your password:
      ${resetUrl}

      This link will expire in ${PASSWORD_RESET_EXPIRY_HOURS} hour(s).

      If you didn't request this, please ignore this email.

      Best regards,
      Wilson Admin Team
    `;

    try {
      await sendEmail(
        'Wilson Admin',
        adminUser.email,
        'Password Reset Request - Wilson Admin',
        emailText,
        emailHtml
      );
      console.log(`Password reset email sent to admin: ${adminUser.email}`);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Don't throw - we don't want to reveal email existence
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(token, newPassword) {
    const hashedToken = hashToken(token);

    // Find valid reset token
    const { data: resetRecord, error } = await supabase
      .from('admin_password_resets')
      .select('*')
      .eq('token', hashedToken)
      .is('used_at', null)
      .single();

    if (error || !resetRecord) {
      throw new BadRequestError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    // Check if token is expired
    if (new Date(resetRecord.expires_at) < new Date()) {
      throw new BadRequestError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', resetRecord.admin_user_id);

    if (updateError) {
      throw new Error('Failed to update password');
    }

    // Mark token as used
    await supabase
      .from('admin_password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetRecord.id);

    // Revoke all refresh tokens for this user (force re-login)
    await supabase
      .from('admin_refresh_tokens')
      .delete()
      .eq('admin_user_id', resetRecord.admin_user_id);

    console.log(`Password reset successful for admin user: ${resetRecord.admin_user_id}`);
  }
}

module.exports = new AuthService();

const crypto = require('crypto');

const generateRandomToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const calculateExpiry = (hours) => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
};

const sanitizeUser = (user) => {
  const { password_hash, ...sanitized } = user;
  return sanitized;
};

const generateSecurePassword = (length = 12) => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%&*';
  const all = uppercase + lowercase + numbers + special;

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const formatSuccessResponse = ({ message = 'Success', data = null, pagination = null } = {}) => {
  const response = {
    success: true,
    message
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  if (pagination) {
    response.pagination = pagination;
  }

  return response;
};

const formatErrorResponse = ({ code, message, details = null }) => {
  const response = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details !== null && details !== undefined) {
    response.error.details = details;
  }

  return response;
};

const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  ACCESS_DENIED: 'ACCESS_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
};

const SuccessMessages = {
  SUCCESS: 'Success',
  OPERATION_COMPLETED: 'Operation completed successfully',
  CREATED: 'Created successfully',
  UPDATED: 'Updated successfully',
  DELETED: 'Deleted successfully',
  FETCHED: 'Data retrieved successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_CHANGED: 'Password changed successfully',
  PASSWORD_RESET_SENT: 'Password reset email sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successful'
};

const roundMoney = (value) => Math.round(value * 100) / 100;

/**
 * Generate order number: WIL-YYYYMMDD-XXX
 */
const generateOrderNumber = async (supabase) => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `WIL-${dateStr}-`;

  // Get today's order count
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .like('order_number', `${prefix}%`);

  const seq = String((count || 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
};

module.exports = {
  roundMoney,
  generateRandomToken,
  hashToken,
  calculateExpiry,
  sanitizeUser,
  generateSecurePassword,
  formatSuccessResponse,
  formatErrorResponse,
  ErrorCodes,
  SuccessMessages,
  generateOrderNumber
};

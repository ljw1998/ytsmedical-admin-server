// Application-wide constants

// Password reset token expiry (in hours)
const PASSWORD_RESET_EXPIRY_HOURS = 1;

// JWT token expiry
const JWT_EXPIRY = {
  ACCESS_TOKEN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
};

// Pagination Defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// Error Messages
const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  USER_NOT_FOUND: 'User not found',
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_TOKEN: 'Invalid or expired token',
  ACCOUNT_DISABLED: 'Account has been disabled',
  EMAIL_ALREADY_EXISTS: 'Email already exists'
};

// Success Messages
const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logged out successfully',
  PASSWORD_RESET_SENT: 'If an account with that email exists, a password reset link has been sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  TOKEN_REFRESHED: 'Token refreshed successfully'
};

// Upload limits
const UPLOAD = {
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB
  MAX_FILES: 5,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  // Extended types for document uploads (Shopee/COD reports)
  ALLOWED_DOCUMENT_TYPES: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'],
  ALLOWED_DOCUMENT_EXTENSIONS: ['.xlsx', '.xls', '.csv'],
  MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
  // Payment proof uploads
  ALLOWED_PROOF_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  ALLOWED_PROOF_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
  MAX_PROOF_SIZE: 10 * 1024 * 1024 // 10MB
};

// Order status values
const ORDER_STATUSES = [
  'created', 'pending_pickup', 'in_transit', 'out_for_delivery',
  'shipped', 'ready_for_pickup', 'collected',
  'delivered', 'completed',
  'returned', 'restocked', 'lost', 'cancelled', 'imported', 'recorded'
];

// Source channels
const SOURCE_CHANNELS = ['facebook_ad', 'whatsapp', 'shopee', 'agent', 'other'];

// Order sources
const ORDER_SOURCES = ['facebook_ad', 'whatsapp', 'shopee', 'agent', 'manual'];

// Payment types
const PAYMENT_TYPES = ['manual', 'cod', 'shopee'];

// Payment methods
const PAYMENT_METHODS = ['bank_transfer', 'online_banking', 'ewallet', 'credit_card', 'payment_gateway', 'cash', 'cod', 'shopee', 'other'];

// Payment statuses
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'cod_pending', 'cod_collected', 'refunded'];

// Fulfilment types
const FULFILMENT_TYPES = ['ninjavan', 'other_courier', 'self_pickup', 'shopee', 'agent'];

// Stock movement types
const MOVEMENT_TYPES = ['stock_in', 'stock_out', 'transfer_out', 'transfer_in', 'adjustment', 'return', 'bundle_sale', 'shopee_sale', 'agent_sale'];

// NinjaVan webhook event to order status mapping
const NINJAVAN_EVENT_STATUS_MAP = {
  'Pending Pickup': 'pending_pickup',
  'Picked Up, In Transit to Origin Hub': 'in_transit',
  'Arrived at Origin Hub': 'in_transit',
  'In Transit to Next Hub': 'in_transit',
  'Arrived at Transit Hub': 'in_transit',
  'On Vehicle for Delivery': 'out_for_delivery',
  'Delivered, Received by Customer': 'delivered',
  'Delivered, Left at Doorstep': 'delivered',
  'Delivered, Collected by Customer': 'delivered',
  'Returned to Sender': 'returned',
  'Cancelled': 'cancelled'
};

// NinjaVan events that should not change status but add notes
const NINJAVAN_NOTE_EVENTS = [
  'Delivery Exception, Pending Reschedule',
  'Delivery Exception, Max Attempts Reached'
];

// NinjaVan delivered events (for COD payment processing)
const NINJAVAN_DELIVERED_EVENTS = [
  'Delivered, Received by Customer',
  'Delivered, Left at Doorstep',
  'Delivered, Collected by Customer'
];

module.exports = {
  PASSWORD_RESET_EXPIRY_HOURS,
  JWT_EXPIRY,
  PAGINATION,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  UPLOAD,
  ORDER_STATUSES,
  SOURCE_CHANNELS,
  ORDER_SOURCES,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  FULFILMENT_TYPES,
  MOVEMENT_TYPES,
  NINJAVAN_EVENT_STATUS_MAP,
  NINJAVAN_NOTE_EVENTS,
  NINJAVAN_DELIVERED_EVENTS
};

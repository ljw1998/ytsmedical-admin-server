const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { formatSuccessResponse, formatErrorResponse, ErrorCodes } = require('./utils/helpers');

// Import routes
const authRoutes = require('./routes/auth.routes');
const rolesRoutes = require('./routes/roles.routes');
const usersRoutes = require('./routes/users.routes');
const categoriesRoutes = require('./routes/categories.routes');
const productsRoutes = require('./routes/products.routes');
const bundlesRoutes = require('./routes/bundles.routes');
const customersRoutes = require('./routes/customers.routes');
const ordersRoutes = require('./routes/orders.routes');
const stockRoutes = require('./routes/stock.routes');
const storageLocationsRoutes = require('./routes/storage-locations.routes');
const campaignsRoutes = require('./routes/campaigns.routes');
const metaAdsRoutes = require('./routes/meta-ads.routes');
const ninjavanRoutes = require('./routes/ninjavan.routes');
const shopeeRoutes = require('./routes/shopee.routes');
const codReportsRoutes = require('./routes/cod-reports.routes');
const agentsRoutes = require('./routes/agents.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const activityLogsRoutes = require('./routes/activity-logs.routes');

// Initialize express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General rate limiting
app.use(generalLimiter);

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json(formatSuccessResponse({
    message: 'Admin server is healthy',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  }));
});

// API routes
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/roles', rolesRoutes);
app.use('/api/admin/users', usersRoutes);
app.use('/api/admin/categories', categoriesRoutes);
app.use('/api/admin/products', productsRoutes);
app.use('/api/admin/bundles', bundlesRoutes);
app.use('/api/admin/customers', customersRoutes);
app.use('/api/admin/orders', ordersRoutes);
app.use('/api/admin/stock', stockRoutes);
app.use('/api/admin/storage-locations', storageLocationsRoutes);
app.use('/api/admin/campaigns', campaignsRoutes);
app.use('/api/admin/meta-ads', metaAdsRoutes);
app.use('/api/admin/shopee', shopeeRoutes);
app.use('/api/admin/cod-reports', codReportsRoutes);
app.use('/api/admin/agents', agentsRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/activity-logs', activityLogsRoutes);

// NinjaVan webhook (public endpoint — separate from /api/admin/)
app.use('/api/webhooks/ninjavan', ninjavanRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json(formatErrorResponse({
    code: ErrorCodes.ROUTE_NOT_FOUND,
    message: `Route ${req.method} ${req.path} not found`
  }));
});

// Global error handler
app.use(errorHandler);

module.exports = app;

const express = require('express');
const router = express.Router();

const metaAdsController = require('../controllers/meta-ads.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validation');
const {
  createAdAccountValidation,
  updateAdAccountValidation,
  manualSyncValidation,
  uuidParam,
} = require('../validators/meta-ads.validator');

// All routes require authentication
router.use(authenticate);

// ─── Ad Accounts ─────────────────────────────────────────────

// GET /accounts - List all ad accounts
router.get(
  '/accounts',
  requirePermission('settings.view'),
  metaAdsController.listAccounts
);

// POST /accounts - Create ad account
router.post(
  '/accounts',
  requirePermission('settings.update'),
  createAdAccountValidation,
  validate,
  metaAdsController.createAccount
);

// PUT /accounts/:id - Update ad account
router.put(
  '/accounts/:id',
  requirePermission('settings.update'),
  updateAdAccountValidation,
  validate,
  metaAdsController.updateAccount
);

// DELETE /accounts/:id - Delete ad account
router.delete(
  '/accounts/:id',
  requirePermission('settings.update'),
  uuidParam,
  validate,
  metaAdsController.deleteAccount
);

// ─── Sync Endpoints ─────────────────────────────────────────

// POST /sync-daily - Cloud Scheduler cron: sync all active accounts (last 7 days)
router.post(
  '/sync-daily',
  requirePermission('campaigns.sync'),
  metaAdsController.syncDaily
);

// POST /sync-manual - Manual sync with date range
router.post(
  '/sync-manual',
  requirePermission('campaigns.sync'),
  manualSyncValidation,
  validate,
  metaAdsController.syncManual
);

// ─── Logs & Data ────────────────────────────────────────────

// GET /sync-logs - List sync logs
router.get(
  '/sync-logs',
  requirePermission('campaigns.view'),
  metaAdsController.listSyncLogs
);

// GET /daily-spend - Get daily spend data
router.get(
  '/daily-spend',
  requirePermission('campaigns.view'),
  metaAdsController.getDailySpend
);

module.exports = router;

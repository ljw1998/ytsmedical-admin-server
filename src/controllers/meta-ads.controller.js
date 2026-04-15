const metaAdsService = require('../services/meta-ads.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

class MetaAdsController {
  // ─── Ad Accounts ───────────────────────────────────────────

  /**
   * GET /accounts - List all ad accounts
   */
  async listAccounts(req, res, next) {
    try {
      const accounts = await metaAdsService.listAdAccounts();

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.FETCHED,
          data: accounts,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /accounts - Create an ad account
   */
  async createAccount(req, res, next) {
    try {
      const account = await metaAdsService.createAdAccount(req.body);

      res.status(201).json(
        formatSuccessResponse({
          message: SuccessMessages.CREATED,
          data: account,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /accounts/:id - Update an ad account
   */
  async updateAccount(req, res, next) {
    try {
      const account = await metaAdsService.updateAdAccount(req.params.id, req.body);

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.UPDATED,
          data: account,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /accounts/:id - Delete an ad account
   */
  async deleteAccount(req, res, next) {
    try {
      const result = await metaAdsService.deleteAdAccount(req.params.id);

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.DELETED,
          data: result,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  // ─── Sync Endpoints ───────────────────────────────────────

  /**
   * POST /sync-daily - Cloud Scheduler cron endpoint: sync all active accounts (last 7 days)
   */
  async syncDaily(req, res, next) {
    try {
      const results = await metaAdsService.syncAllAccounts();

      res.json(
        formatSuccessResponse({
          message: 'Daily sync completed',
          data: results,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /sync-manual - Manual sync with date range
   */
  async syncManual(req, res, next) {
    try {
      const { ad_account_id, since, until } = req.body;
      const userId = req.user ? req.user.id : null;

      const result = await metaAdsService.syncDailySpend(
        ad_account_id,
        since,
        until,
        'manual_trigger',
        userId
      );

      res.json(
        formatSuccessResponse({
          message: 'Manual sync completed',
          data: result,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  // ─── Logs & Data ──────────────────────────────────────────

  /**
   * GET /sync-logs - List sync logs with pagination
   */
  async listSyncLogs(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        ad_account_id,
        status,
      } = req.query;

      const result = await metaAdsService.listSyncLogs({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        ad_account_id,
        status,
      });

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.FETCHED,
          data: result.data,
          pagination: result.pagination,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /daily-spend - Get daily spend data with filters
   */
  async getDailySpend(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        campaign_id,
        date_from,
        date_to,
      } = req.query;

      const result = await metaAdsService.getDailySpend({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        campaign_id,
        date_from,
        date_to,
      });

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.FETCHED,
          data: result.data,
          pagination: result.pagination,
        })
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MetaAdsController();

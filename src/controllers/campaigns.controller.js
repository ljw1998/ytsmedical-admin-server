const campaignsService = require('../services/campaigns.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

class CampaignsController {
  /**
   * GET / - List campaigns with pagination, search, and filters
   */
  async list(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        platform,
        objective,
        ad_account_id,
      } = req.query;

      const result = await campaignsService.list({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search,
        status,
        platform,
        objective,
        ad_account_id,
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
   * GET /:id - Get a single campaign by ID (includes spend summary)
   */
  async getById(req, res, next) {
    try {
      const campaign = await campaignsService.getById(req.params.id);

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.FETCHED,
          data: campaign,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST / - Create a new campaign
   */
  async create(req, res, next) {
    try {
      const campaign = await campaignsService.create(req.body);

      res.status(201).json(
        formatSuccessResponse({
          message: SuccessMessages.CREATED,
          data: campaign,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /:id - Update a campaign
   */
  async update(req, res, next) {
    try {
      const campaign = await campaignsService.update(req.params.id, req.body);

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.UPDATED,
          data: campaign,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /:id - Delete a campaign
   */
  async delete(req, res, next) {
    try {
      const result = await campaignsService.delete(req.params.id);

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
}

module.exports = new CampaignsController();

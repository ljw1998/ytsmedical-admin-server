const bundlesService = require('../services/bundles.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

class BundlesController {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;

      const result = await bundlesService.list({ page, limit, search });

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data: result.data,
        pagination: result.pagination,
      }));
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;

      const bundle = await bundlesService.getById(id);

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data: bundle,
      }));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const bundle = await bundlesService.create(req.body);

      res.status(201).json(formatSuccessResponse({
        message: SuccessMessages.CREATED,
        data: bundle,
      }));
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;

      const bundle = await bundlesService.update(id, req.body);

      res.json(formatSuccessResponse({
        message: SuccessMessages.UPDATED,
        data: bundle,
      }));
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;

      await bundlesService.delete(id);

      res.json(formatSuccessResponse({
        message: SuccessMessages.DELETED,
      }));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BundlesController();

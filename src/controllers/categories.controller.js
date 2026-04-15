const categoriesService = require('../services/categories.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

class CategoriesController {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;

      const result = await categoriesService.list({ page, limit, search });

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

      const category = await categoriesService.getById(id);

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data: category,
      }));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const category = await categoriesService.create(req.body);

      res.status(201).json(formatSuccessResponse({
        message: SuccessMessages.CREATED,
        data: category,
      }));
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;

      const category = await categoriesService.update(id, req.body);

      res.json(formatSuccessResponse({
        message: SuccessMessages.UPDATED,
        data: category,
      }));
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;

      await categoriesService.delete(id);

      res.json(formatSuccessResponse({
        message: SuccessMessages.DELETED,
      }));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoriesController();

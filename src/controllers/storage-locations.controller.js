const storageLocationsService = require('../services/storage-locations.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

class StorageLocationsController {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '', status = '', location_type = '' } = req.query;

      const result = await storageLocationsService.list({ page, limit, search, status, location_type });

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

      const location = await storageLocationsService.getById(id);

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data: location,
      }));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const location = await storageLocationsService.create(req.body);

      res.status(201).json(formatSuccessResponse({
        message: SuccessMessages.CREATED,
        data: location,
      }));
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;

      const location = await storageLocationsService.update(id, req.body);

      res.json(formatSuccessResponse({
        message: SuccessMessages.UPDATED,
        data: location,
      }));
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;

      await storageLocationsService.delete(id);

      res.json(formatSuccessResponse({
        message: SuccessMessages.DELETED,
      }));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StorageLocationsController();

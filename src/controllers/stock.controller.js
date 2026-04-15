const stockService = require('../services/stock.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

class StockController {
  async getStockOverview(req, res, next) {
    try {
      const data = await stockService.getStockOverview();

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data,
      }));
    } catch (error) {
      next(error);
    }
  }

  async getLowStockAlerts(req, res, next) {
    try {
      const data = await stockService.getLowStockAlerts();

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data,
      }));
    } catch (error) {
      next(error);
    }
  }

  async getStockByLocation(req, res, next) {
    try {
      const { locationId } = req.params;

      const data = await stockService.getStockByLocation(locationId);

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data,
      }));
    } catch (error) {
      next(error);
    }
  }

  async getStockByProduct(req, res, next) {
    try {
      const { productId } = req.params;

      const data = await stockService.getStockByProduct(productId);

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data,
      }));
    } catch (error) {
      next(error);
    }
  }

  async adjustStock(req, res, next) {
    try {
      const { location_id, product_id, movement_type, quantity, notes } = req.body;
      const userId = req.user ? req.user.id : null;

      const movement = await stockService.adjustStock(
        location_id,
        product_id,
        movement_type,
        quantity,
        notes,
        userId
      );

      res.status(201).json(formatSuccessResponse({
        message: 'Stock adjusted successfully',
        data: movement,
      }));
    } catch (error) {
      next(error);
    }
  }

  async listMovements(req, res, next) {
    try {
      const { page = 1, limit = 20, location_id = '', product_id = '', movement_type = '', date_from = '', date_to = '' } = req.query;

      const result = await stockService.listMovements({
        page,
        limit,
        location_id,
        product_id,
        movement_type,
        date_from,
        date_to,
      });

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data: result.data,
        pagination: result.pagination,
      }));
    } catch (error) {
      next(error);
    }
  }

  async listTransfers(req, res, next) {
    try {
      const { page = 1, limit = 20, status = '', from_location_id = '', to_location_id = '' } = req.query;

      const result = await stockService.listTransfers({
        page,
        limit,
        status,
        from_location_id,
        to_location_id,
      });

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data: result.data,
        pagination: result.pagination,
      }));
    } catch (error) {
      next(error);
    }
  }

  async getTransferById(req, res, next) {
    try {
      const { id } = req.params;

      const transfer = await stockService.getTransferById(id);

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data: transfer,
      }));
    } catch (error) {
      next(error);
    }
  }

  async createTransfer(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;

      const transfer = await stockService.createTransfer(req.body, userId);

      res.status(201).json(formatSuccessResponse({
        message: SuccessMessages.CREATED,
        data: transfer,
      }));
    } catch (error) {
      next(error);
    }
  }

  async receiveTransfer(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user ? req.user.id : null;

      const transfer = await stockService.receiveTransfer(id, userId);

      res.json(formatSuccessResponse({
        message: SuccessMessages.UPDATED,
        data: transfer,
      }));
    } catch (error) {
      next(error);
    }
  }

  async cancelTransfer(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user ? req.user.id : null;

      const transfer = await stockService.cancelTransfer(id, userId);

      res.json(formatSuccessResponse({
        message: SuccessMessages.UPDATED,
        data: transfer,
      }));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StockController();

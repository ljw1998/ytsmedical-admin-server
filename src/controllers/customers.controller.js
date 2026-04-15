const customersService = require('../services/customers.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

class CustomersController {
  /**
   * GET / - List customers with pagination, search, and filters
   */
  async listCustomers(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        source_channel,
        source_campaign_id,
        tags,
      } = req.query;

      // Parse tags from comma-separated string if provided
      const parsedTags = tags ? (Array.isArray(tags) ? tags : tags.split(',')) : undefined;

      const result = await customersService.listCustomers({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search,
        source_channel,
        source_campaign_id,
        tags: parsedTags,
      });

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.FETCHED,
          data: result.customers,
          pagination: result.pagination,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:id - Get a single customer by ID
   */
  async getCustomerById(req, res, next) {
    try {
      const customer = await customersService.getCustomerById(req.params.id);

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.FETCHED,
          data: customer,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST / - Create a new customer
   */
  async createCustomer(req, res, next) {
    try {
      const customer = await customersService.createCustomer(req.body);

      res.status(201).json(
        formatSuccessResponse({
          message: SuccessMessages.CREATED,
          data: customer,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /:id - Update a customer
   */
  async updateCustomer(req, res, next) {
    try {
      const customer = await customersService.updateCustomer(req.params.id, req.body);

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.UPDATED,
          data: customer,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /:id - Delete a customer
   */
  async deleteCustomer(req, res, next) {
    try {
      const result = await customersService.deleteCustomer(req.params.id);

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

  // ─── Address Endpoints ──────────────────────────────────────

  /**
   * GET /:id/addresses - List addresses for a customer
   */
  async listAddresses(req, res, next) {
    try {
      const addresses = await customersService.listAddresses(req.params.id);

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.FETCHED,
          data: addresses,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /:id/addresses - Create an address for a customer
   */
  async createAddress(req, res, next) {
    try {
      const address = await customersService.createAddress(req.params.id, req.body);

      res.status(201).json(
        formatSuccessResponse({
          message: SuccessMessages.CREATED,
          data: address,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /:id/addresses/:addressId - Update an address
   */
  async updateAddress(req, res, next) {
    try {
      const address = await customersService.updateAddress(
        req.params.id,
        req.params.addressId,
        req.body
      );

      res.json(
        formatSuccessResponse({
          message: SuccessMessages.UPDATED,
          data: address,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /:id/addresses/:addressId - Delete an address
   */
  async deleteAddress(req, res, next) {
    try {
      const result = await customersService.deleteAddress(req.params.id, req.params.addressId);

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

module.exports = new CustomersController();

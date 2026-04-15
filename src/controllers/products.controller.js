const productsService = require('../services/products.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

class ProductsController {
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '', category_id, status } = req.query;

      const result = await productsService.list({ page, limit, search, category_id, status });

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

      const product = await productsService.getById(id);

      res.json(formatSuccessResponse({
        message: SuccessMessages.FETCHED,
        data: product,
      }));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const productData = { ...req.body };

      // Handle image upload
      if (req.file) {
        const imageUrl = await productsService.uploadImage(req.file);
        productData.image_url = imageUrl;
      }

      const product = await productsService.create(productData);

      res.status(201).json(formatSuccessResponse({
        message: SuccessMessages.CREATED,
        data: product,
      }));
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const productData = { ...req.body };

      // Handle image upload
      if (req.file) {
        // Get existing product to delete old image
        const existing = await productsService.getById(id);
        if (existing.image_url) {
          await productsService.deleteImage(existing.image_url);
        }

        const imageUrl = await productsService.uploadImage(req.file);
        productData.image_url = imageUrl;
      }

      const product = await productsService.update(id, productData);

      res.json(formatSuccessResponse({
        message: SuccessMessages.UPDATED,
        data: product,
      }));
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;

      // Get existing product to delete image
      const existing = await productsService.getById(id);
      if (existing.image_url) {
        await productsService.deleteImage(existing.image_url);
      }

      await productsService.delete(id);

      res.json(formatSuccessResponse({
        message: SuccessMessages.DELETED,
      }));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductsController();

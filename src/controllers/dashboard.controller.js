const dashboardService = require('../services/dashboard.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

/**
 * Get daily summary
 */
const getDailySummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getDailySummary(req.query.date);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get order statistics
 */
const getOrderStats = async (req, res, next) => {
  try {
    const data = await dashboardService.getOrderStats(req.query.date_from, req.query.date_to);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get campaign performance
 */
const getCampaignPerformance = async (req, res, next) => {
  try {
    const data = await dashboardService.getCampaignPerformance(req.query.date_from, req.query.date_to);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get COD analytics
 */
const getCodAnalytics = async (req, res, next) => {
  try {
    const data = await dashboardService.getCodAnalytics(req.query.date_from, req.query.date_to);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get stock summary
 */
const getStockSummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getStockSummary();

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get business overview
 */
const getBusinessOverview = async (req, res, next) => {
  try {
    const data = await dashboardService.getBusinessOverview(req.query.date_from, req.query.date_to);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDailySummary,
  getOrderStats,
  getCampaignPerformance,
  getCodAnalytics,
  getStockSummary,
  getBusinessOverview,
};

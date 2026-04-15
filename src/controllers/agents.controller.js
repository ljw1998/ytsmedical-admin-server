const agentsService = require('../services/agents.service');
const { formatSuccessResponse, SuccessMessages } = require('../utils/helpers');

/**
 * List agent sales
 */
const listSales = async (req, res, next) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || undefined,
      limit: parseInt(req.query.limit) || undefined,
      agent_id: req.query.agent_id,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };

    const result = await agentsService.listAgentSales(filters);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data: result.data,
      pagination: result.pagination,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Record an agent sale
 */
const recordSale = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const sale = await agentsService.recordSale(req.body, userId);

    res.status(201).json(formatSuccessResponse({
      message: SuccessMessages.CREATED,
      data: sale,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * List stock allocations for an agent
 */
const listAllocations = async (req, res, next) => {
  try {
    const data = await agentsService.listAllocations(req.params.agentId);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Allocate stock to an agent
 */
const allocateStock = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const allocation = await agentsService.allocateStock(req.body, userId);

    res.status(201).json(formatSuccessResponse({
      message: SuccessMessages.CREATED,
      data: allocation,
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get agent stock balance
 */
const getStockBalance = async (req, res, next) => {
  try {
    const data = await agentsService.getAgentStockBalance(req.params.agentId);

    res.json(formatSuccessResponse({
      message: SuccessMessages.FETCHED,
      data,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listSales,
  recordSale,
  listAllocations,
  allocateStock,
  getStockBalance,
};

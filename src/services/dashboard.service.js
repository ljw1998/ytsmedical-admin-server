const supabase = require('../config/database');
const { BadRequestError } = require('../utils/errors');
const { roundMoney } = require('../utils/helpers');

/**
 * Get daily summary for a specific date
 */
const getDailySummary = async (date) => {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  // Orders created today
  const { data: orders, count: orderCount } = await supabase
    .from('orders')
    .select('id, total_amount, payment_status, order_source', { count: 'exact' })
    .gte('order_date', targetDate)
    .lte('order_date', targetDate);

  const totalRevenue = orders
    ? orders.reduce((sum, o) => roundMoney(sum + parseFloat(o.total_amount || 0)), 0)
    : 0;

  const paidOrders = orders ? orders.filter(o => o.payment_status === 'paid').length : 0;

  // Ad spend today
  const { data: adSpend } = await supabase
    .from('campaign_daily_spend')
    .select('amount_spent')
    .eq('date', targetDate);

  const totalAdSpend = adSpend
    ? adSpend.reduce((sum, s) => roundMoney(sum + parseFloat(s.amount_spent || 0)), 0)
    : 0;

  return {
    date: targetDate,
    total_orders: orderCount || 0,
    total_revenue: totalRevenue,
    paid_orders: paidOrders,
    total_ad_spend: totalAdSpend,
    roas: totalAdSpend > 0 ? roundMoney(totalRevenue / totalAdSpend) : null,
  };
};

/**
 * Get order statistics for a date range
 */
const getOrderStats = async (dateFrom, dateTo) => {
  let query = supabase
    .from('orders')
    .select('id, order_status, order_source, payment_status, total_amount, order_date');

  if (dateFrom) query = query.gte('order_date', dateFrom);
  if (dateTo) query = query.lte('order_date', dateTo);

  const { data: orders, error } = await query;

  if (error) {
    throw new BadRequestError(`Failed to fetch order stats: ${error.message}`);
  }

  // Group by status
  const byStatus = {};
  const bySource = {};
  let totalRevenue = 0;
  let totalOrders = orders ? orders.length : 0;

  if (orders) {
    for (const order of orders) {
      byStatus[order.order_status] = (byStatus[order.order_status] || 0) + 1;
      bySource[order.order_source] = (bySource[order.order_source] || 0) + 1;
      totalRevenue = roundMoney(totalRevenue + parseFloat(order.total_amount || 0));
    }
  }

  return {
    total_orders: totalOrders,
    total_revenue: totalRevenue,
    by_status: byStatus,
    by_source: bySource,
  };
};

/**
 * Get campaign performance for a date range
 */
const getCampaignPerformance = async (dateFrom, dateTo) => {
  let query = supabase
    .from('campaign_daily_spend')
    .select('*, campaign:campaigns!campaign_id(id, campaign_name)');

  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  query = query.order('date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new BadRequestError(`Failed to fetch campaign performance: ${error.message}`);
  }

  // Aggregate by campaign
  const byCampaign = {};
  if (data) {
    for (const row of data) {
      const cid = row.campaign_id;
      if (!byCampaign[cid]) {
        byCampaign[cid] = {
          campaign_id: cid,
          campaign_name: row.campaign?.campaign_name || 'Unknown',
          total_spend: 0,
          total_reach: 0,
          total_impressions: 0,
          days: 0,
        };
      }
      byCampaign[cid].total_spend = roundMoney(byCampaign[cid].total_spend + parseFloat(row.amount_spent || 0));
      byCampaign[cid].total_reach += parseInt(row.reach || 0);
      byCampaign[cid].total_impressions += parseInt(row.impressions || 0);
      byCampaign[cid].days++;
    }
  }

  return Object.values(byCampaign);
};

/**
 * Get COD analytics for a date range
 */
const getCodAnalytics = async (dateFrom, dateTo) => {
  let query = supabase
    .from('orders')
    .select('id, total_amount, payment_status, order_status, order_date')
    .eq('payment_type', 'cod');

  if (dateFrom) query = query.gte('order_date', dateFrom);
  if (dateTo) query = query.lte('order_date', dateTo);

  const { data: orders, error } = await query;

  if (error) {
    throw new BadRequestError(`Failed to fetch COD analytics: ${error.message}`);
  }

  let total_cod_orders = 0;
  let total_cod_amount = 0;
  let cod_collected = 0;
  let cod_pending = 0;
  let cod_collected_amount = 0;
  let cod_pending_amount = 0;

  if (orders) {
    for (const order of orders) {
      total_cod_orders++;
      const amount = parseFloat(order.total_amount || 0);
      total_cod_amount = roundMoney(total_cod_amount + amount);

      if (order.payment_status === 'cod_collected' || order.payment_status === 'paid') {
        cod_collected++;
        cod_collected_amount = roundMoney(cod_collected_amount + amount);
      } else {
        cod_pending++;
        cod_pending_amount = roundMoney(cod_pending_amount + amount);
      }
    }
  }

  return {
    total_cod_orders,
    total_cod_amount,
    cod_collected,
    cod_pending,
    cod_collected_amount,
    cod_pending_amount,
  };
};

/**
 * Get stock summary
 */
const getStockSummary = async () => {
  const { data: stock, error } = await supabase
    .from('stock')
    .select('*, product:products(id, product_name, sku), location:storage_locations(id, location_name)');

  if (error) {
    throw new BadRequestError(`Failed to fetch stock summary: ${error.message}`);
  }

  let total_items = 0;
  let total_quantity = 0;
  let low_stock_count = 0;

  if (stock) {
    for (const item of stock) {
      total_items++;
      total_quantity += item.quantity || 0;
      if (item.quantity <= item.low_stock_threshold) {
        low_stock_count++;
      }
    }
  }

  return {
    total_items,
    total_quantity,
    low_stock_count,
    items: stock || [],
  };
};

/**
 * Get business overview for a date range
 */
const getBusinessOverview = async (dateFrom, dateTo) => {
  const [orderStats, codAnalytics, stockSummary] = await Promise.all([
    getOrderStats(dateFrom, dateTo),
    getCodAnalytics(dateFrom, dateTo),
    getStockSummary(),
  ]);

  // Ad spend for the period
  let adQuery = supabase
    .from('campaign_daily_spend')
    .select('amount_spent');

  if (dateFrom) adQuery = adQuery.gte('date', dateFrom);
  if (dateTo) adQuery = adQuery.lte('date', dateTo);

  const { data: adData } = await adQuery;
  const total_ad_spend = adData
    ? adData.reduce((sum, s) => roundMoney(sum + parseFloat(s.amount_spent || 0)), 0)
    : 0;

  return {
    orders: orderStats,
    cod: codAnalytics,
    stock: {
      total_items: stockSummary.total_items,
      total_quantity: stockSummary.total_quantity,
      low_stock_count: stockSummary.low_stock_count,
    },
    ad_spend: total_ad_spend,
    roas: total_ad_spend > 0 ? roundMoney(orderStats.total_revenue / total_ad_spend) : null,
  };
};

module.exports = {
  getDailySummary,
  getOrderStats,
  getCampaignPerformance,
  getCodAnalytics,
  getStockSummary,
  getBusinessOverview,
};

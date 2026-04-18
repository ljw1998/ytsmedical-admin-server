const supabase = require('../config/database');
const { BadRequestError } = require('../utils/errors');
const { roundMoney } = require('../utils/helpers');

const safeDivide = (a, b) => (b > 0 ? roundMoney(a / b) : null);
const daysInMonth = (dateStr) => new Date(new Date(dateStr).getFullYear(), new Date(dateStr).getMonth() + 1, 0).getDate();
const monthStart = (dateStr) => { const d = new Date(dateStr); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const dayOfMonth = (dateStr) => new Date(dateStr).getDate();
const sumField = (arr, field) => (arr || []).reduce((s, r) => s + parseFloat(r[field] || 0), 0);
const sumInt = (arr, field) => (arr || []).reduce((s, r) => s + parseInt(r[field] || 0), 0);
const filterOrders = (orders, source, type) => (orders || []).filter(o => (!source || o.order_source === source) && (!type || o.order_type === type));

// ─── 1. Daily Summary (Race Report replacement) ─────────────

const getDailySummary = async (date) => {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const mtdStart = monthStart(targetDate);
  const totalDays = daysInMonth(targetDate);
  const currentDay = dayOfMonth(targetDate);

  const [{ data: ordersToday }, { data: ordersMtd }, { data: adToday }, { data: adMtd }] = await Promise.all([
    supabase.from('orders').select('id, total_amount, order_type, order_source, payment_type, payment_status').eq('order_date', targetDate),
    supabase.from('orders').select('id, total_amount, order_type, order_source, order_date').gte('order_date', mtdStart).lte('order_date', targetDate),
    supabase.from('campaign_daily_spend').select('amount_spent, new_messaging_contacts, messaging_conversations_started, total_messaging_connections, post_engagements').eq('date', targetDate),
    supabase.from('campaign_daily_spend').select('amount_spent, new_messaging_contacts, total_messaging_connections').gte('date', mtdStart).lte('date', targetDate),
  ]);

  const today = ordersToday || [];
  const sumRev = (arr) => roundMoney(sumField(arr, 'total_amount'));

  const fbOrders = filterOrders(today, 'facebook_ad');
  const fb_new = filterOrders(fbOrders, null, 'new');
  const fb_repeat = filterOrders(fbOrders, null, 'repeat');

  const ads_spent = roundMoney(sumField(adToday, 'amount_spent'));
  const new_messaging = sumInt(adToday, 'new_messaging_contacts');
  const total_conversations = sumInt(adToday, 'messaging_conversations_started');
  const total_connections = sumInt(adToday, 'total_messaging_connections');
  const total_comments = sumInt(adToday, 'post_engagements');

  const new_orders = filterOrders(today, null, 'new').length;
  const repeat_orders = filterOrders(today, null, 'repeat').length;
  const total_orders = today.length;

  const fb_new_sales = sumRev(fb_new);
  const fb_repeat_sales = sumRev(fb_repeat);
  const total_fb_sales = sumRev(fbOrders);
  const total_shopee_sales = sumRev(filterOrders(today, 'shopee'));
  const total_agent_sales = sumRev(filterOrders(today, 'agent'));
  const total_other_sales = sumRev(today.filter(o => !['facebook_ad', 'shopee', 'agent'].includes(o.order_source)));
  const total_sales = sumRev(today);

  // MTD
  const mtdList = ordersMtd || [];
  const mtd_total_sales = sumRev(mtdList);
  const mtd_fb_sales = sumRev(mtdList.filter(o => o.order_source === 'facebook_ad'));
  const mtd_shopee_sales = sumRev(mtdList.filter(o => o.order_source === 'shopee'));
  const mtd_agent_sales = sumRev(mtdList.filter(o => o.order_source === 'agent'));
  const mtd_ads_spent = roundMoney(sumField(adMtd, 'amount_spent'));
  const mtd_total_messages = sumInt(adMtd, 'total_messaging_connections');

  // ESOM
  const daily_avg = safeDivide(mtd_total_sales, currentDay);
  const remaining_days = totalDays - currentDay;

  return {
    date: targetDate,
    // Ads
    ads_spent, new_messaging_contacts: new_messaging, messaging_conversations_started: total_conversations,
    total_messaging_connections: total_connections, cost_per_message: safeDivide(ads_spent, total_connections), total_comments,
    // Orders
    new_orders, repeat_orders, total_orders,
    new_order_conversion_rate: safeDivide(new_orders, new_messaging),
    total_order_conversion_rate: safeDivide(total_orders, total_connections),
    shopee_orders: filterOrders(today, 'shopee').length,
    // Sales
    fb_new_sales, fb_repeat_sales, total_fb_sales, total_shopee_sales, total_agent_sales, total_other_sales, total_sales,
    cost_per_purchase: safeDivide(ads_spent, fbOrders.length),
    roas_new: safeDivide(fb_new_sales, ads_spent),
    roas_new_repeat: safeDivide(fb_new_sales + fb_repeat_sales, ads_spent),
    roas_total: safeDivide(total_fb_sales, ads_spent),
    // AOV
    new_order_aov: safeDivide(sumRev(filterOrders(today, null, 'new')), new_orders),
    repeat_order_aov: safeDivide(sumRev(filterOrders(today, null, 'repeat')), repeat_orders),
    total_aov: safeDivide(total_sales, total_orders),
    // ESOM
    accumulated_sales_mtd: mtd_total_sales, daily_average_sales: daily_avg,
    estimated_sales_of_month: daily_avg ? roundMoney(daily_avg * totalDays) : null,
    daily_optimum_sales: remaining_days > 0 ? safeDivide(mtd_total_sales, remaining_days) : null,
    // MTD
    mtd_ads_spent, mtd_total_sales, mtd_fb_sales, mtd_shopee_sales, mtd_agent_sales,
    mtd_roas: safeDivide(mtd_total_sales, mtd_ads_spent),
    mtd_total_orders: mtdList.length, mtd_total_messages, mtd_cost_per_message: safeDivide(mtd_ads_spent, mtd_total_messages),
  };
};

// ─── 2. Daily Trend (Race Report rows for a date range) ─────

const getDailyTrend = async (dateFrom, dateTo) => {
  if (!dateFrom || !dateTo) throw new BadRequestError('date_from and date_to are required');

  const [{ data: orders }, { data: adSpend }] = await Promise.all([
    supabase.from('orders').select('id, total_amount, order_type, order_source, order_date').gte('order_date', dateFrom).lte('order_date', dateTo),
    supabase.from('campaign_daily_spend').select('date, amount_spent, new_messaging_contacts, messaging_conversations_started, total_messaging_connections').gte('date', dateFrom).lte('date', dateTo),
  ]);

  const ordersByDate = {};
  for (const o of (orders || [])) { if (!ordersByDate[o.order_date]) ordersByDate[o.order_date] = []; ordersByDate[o.order_date].push(o); }
  const adByDate = {};
  for (const r of (adSpend || [])) { if (!adByDate[r.date]) adByDate[r.date] = []; adByDate[r.date].push(r); }

  const rows = [];
  let accumulated = 0;
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  let dayIndex = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dayIndex++;
    const dateStr = d.toISOString().slice(0, 10);
    const dayOrders = ordersByDate[dateStr] || [];
    const dayAd = adByDate[dateStr] || [];

    const daySpend = roundMoney(sumField(dayAd, 'amount_spent'));
    const dayMessages = sumInt(dayAd, 'total_messaging_connections');
    const dayNewMsg = sumInt(dayAd, 'new_messaging_contacts');
    const daySales = roundMoney(sumField(dayOrders, 'total_amount'));
    const fbOrders = dayOrders.filter(o => o.order_source === 'facebook_ad');
    const fbSales = roundMoney(sumField(fbOrders, 'total_amount'));
    const newOrders = dayOrders.filter(o => o.order_type === 'new');
    accumulated = roundMoney(accumulated + daySales);

    rows.push({
      date: dateStr,
      ads_spent: daySpend, new_messages: dayNewMsg, total_messages: dayMessages,
      cost_per_message: safeDivide(daySpend, dayMessages),
      new_orders: newOrders.length, repeat_orders: dayOrders.filter(o => o.order_type === 'repeat').length,
      total_orders: dayOrders.length,
      fb_sales: fbSales,
      shopee_sales: roundMoney(sumField(dayOrders.filter(o => o.order_source === 'shopee'), 'total_amount')),
      agent_sales: roundMoney(sumField(dayOrders.filter(o => o.order_source === 'agent'), 'total_amount')),
      total_sales: daySales,
      roas: safeDivide(fbSales, daySpend),
      total_aov: safeDivide(daySales, dayOrders.length),
      cost_per_purchase: safeDivide(daySpend, fbOrders.length),
      new_order_conversion: safeDivide(newOrders.length, dayNewMsg),
      total_order_conversion: safeDivide(dayOrders.length, dayMessages),
      accumulated_sales: accumulated,
      daily_average: safeDivide(accumulated, dayIndex),
    });
  }

  return { rows };
};

// ─── 3. Order Statistics ─────────────────────────────────────

const getOrderStats = async (dateFrom, dateTo) => {
  let query = supabase.from('orders').select('id, order_status, order_source, order_type, payment_type, payment_status, total_amount, order_date');
  if (dateFrom) query = query.gte('order_date', dateFrom);
  if (dateTo) query = query.lte('order_date', dateTo);
  const { data: orders, error } = await query;
  if (error) throw new BadRequestError(`Failed: ${error.message}`);

  const list = orders || [];
  const byStatus = {}, bySource = {}, byType = {}, revenueBySource = {}, revenueByType = {};
  let totalRevenue = 0;

  for (const o of list) {
    const amt = parseFloat(o.total_amount || 0);
    totalRevenue = roundMoney(totalRevenue + amt);
    byStatus[o.order_status] = (byStatus[o.order_status] || 0) + 1;
    bySource[o.order_source] = (bySource[o.order_source] || 0) + 1;
    byType[o.order_type] = (byType[o.order_type] || 0) + 1;
    revenueBySource[o.order_source] = roundMoney((revenueBySource[o.order_source] || 0) + amt);
    revenueByType[o.order_type] = roundMoney((revenueByType[o.order_type] || 0) + amt);
  }

  return {
    total_orders: list.length, total_revenue: totalRevenue,
    by_status: byStatus, by_source: bySource, by_type: byType,
    revenue_by_source: revenueBySource, revenue_by_type: revenueByType,
    aov: safeDivide(totalRevenue, list.length),
    new_order_aov: safeDivide(revenueByType['new'] || 0, byType['new'] || 0),
    repeat_order_aov: safeDivide(revenueByType['repeat'] || 0, byType['repeat'] || 0),
  };
};

// ─── 4. Campaign Performance (with revenue join) ─────────────

const getCampaignPerformance = async (dateFrom, dateTo) => {
  let adQuery = supabase.from('campaign_daily_spend')
    .select('campaign_id, amount_spent, reach, impressions, ctr, cpm, new_messaging_contacts, total_messaging_connections, campaign:campaigns!campaign_id(id, campaign_name)');
  if (dateFrom) adQuery = adQuery.gte('date', dateFrom);
  if (dateTo) adQuery = adQuery.lte('date', dateTo);
  const { data: adRows, error: adError } = await adQuery;
  if (adError) throw new BadRequestError(`Failed: ${adError.message}`);

  let orderQuery = supabase.from('orders').select('id, source_campaign_id, order_type, total_amount, payment_type, order_status');
  if (dateFrom) orderQuery = orderQuery.gte('order_date', dateFrom);
  if (dateTo) orderQuery = orderQuery.lte('order_date', dateTo);
  const { data: orderRows } = await orderQuery;

  const { data: customerRows } = await supabase.from('customers').select('source_campaign_id').not('source_campaign_id', 'is', null);

  const byCampaign = {};
  for (const row of (adRows || [])) {
    const cid = row.campaign_id;
    if (!byCampaign[cid]) {
      byCampaign[cid] = {
        campaign_id: cid, campaign_name: row.campaign?.campaign_name || 'Unknown',
        total_spend: 0, total_reach: 0, total_impressions: 0, avg_ctr: 0, avg_cpm: 0,
        new_messaging_contacts: 0, total_messaging_connections: 0, days: 0,
        new_orders: 0, new_order_revenue: 0, repeat_orders: 0, repeat_order_revenue: 0,
        total_orders: 0, total_revenue: 0, cod_orders: 0, cod_returns: 0, customers_acquired: 0,
      };
    }
    const c = byCampaign[cid];
    c.total_spend = roundMoney(c.total_spend + parseFloat(row.amount_spent || 0));
    c.total_reach += parseInt(row.reach || 0);
    c.total_impressions += parseInt(row.impressions || 0);
    c.avg_ctr += parseFloat(row.ctr || 0);
    c.avg_cpm += parseFloat(row.cpm || 0);
    c.new_messaging_contacts += (row.new_messaging_contacts || 0);
    c.total_messaging_connections += (row.total_messaging_connections || 0);
    c.days++;
  }

  for (const c of Object.values(byCampaign)) {
    c.avg_ctr = c.days > 0 ? roundMoney(c.avg_ctr / c.days) : 0;
    c.avg_cpm = c.days > 0 ? roundMoney(c.avg_cpm / c.days) : 0;
  }

  for (const o of (orderRows || [])) {
    const cid = o.source_campaign_id;
    if (!cid || !byCampaign[cid]) continue;
    const c = byCampaign[cid];
    const amt = parseFloat(o.total_amount || 0);
    c.total_orders++; c.total_revenue = roundMoney(c.total_revenue + amt);
    if (o.order_type === 'new') { c.new_orders++; c.new_order_revenue = roundMoney(c.new_order_revenue + amt); }
    else if (o.order_type === 'repeat') { c.repeat_orders++; c.repeat_order_revenue = roundMoney(c.repeat_order_revenue + amt); }
    if (o.payment_type === 'cod') { c.cod_orders++; if (o.order_status === 'returned') c.cod_returns++; }
  }

  for (const cust of (customerRows || [])) {
    if (byCampaign[cust.source_campaign_id]) byCampaign[cust.source_campaign_id].customers_acquired++;
  }

  return Object.values(byCampaign).map(c => ({
    ...c,
    actual_roas_new: safeDivide(c.new_order_revenue, c.total_spend),
    actual_roas_lifetime: safeDivide(c.total_revenue, c.total_spend),
    cac: safeDivide(c.total_spend, c.customers_acquired),
    avg_customer_ltv: safeDivide(c.total_revenue, c.customers_acquired),
    cod_return_rate: safeDivide(c.cod_returns, c.cod_orders),
    cost_per_message: safeDivide(c.total_spend, c.total_messaging_connections),
    cost_per_purchase: safeDivide(c.total_spend, c.total_orders),
  }));
};

// ─── 5. COD Analytics (with breakdowns) ──────────────────────

const getCodAnalytics = async (dateFrom, dateTo) => {
  let query = supabase.from('orders').select('id, total_amount, payment_status, order_status, shipping_fee, shipping_address_id, source_campaign_id, order_date').eq('payment_type', 'cod');
  if (dateFrom) query = query.gte('order_date', dateFrom);
  if (dateTo) query = query.lte('order_date', dateTo);
  const { data: orders, error } = await query;
  if (error) throw new BadRequestError(`Failed: ${error.message}`);

  const list = orders || [];
  let total_cod_orders = 0, total_cod_amount = 0, cod_collected = 0, cod_pending = 0, cod_returned = 0;
  let cod_collected_amount = 0, cod_pending_amount = 0, shipping_cost_lost = 0;
  const returnedIds = [];

  for (const o of list) {
    total_cod_orders++;
    const amt = parseFloat(o.total_amount || 0);
    total_cod_amount = roundMoney(total_cod_amount + amt);
    if (o.order_status === 'returned') {
      cod_returned++; shipping_cost_lost = roundMoney(shipping_cost_lost + parseFloat(o.shipping_fee || 0)); returnedIds.push(o.id);
    } else if (o.payment_status === 'cod_collected' || o.payment_status === 'paid') {
      cod_collected++; cod_collected_amount = roundMoney(cod_collected_amount + amt);
    } else { cod_pending++; cod_pending_amount = roundMoney(cod_pending_amount + amt); }
  }

  // By state
  const byState = {};
  if (list.length > 0) {
    const addrIds = list.map(o => o.shipping_address_id).filter(Boolean);
    if (addrIds.length > 0) {
      const { data: addrs } = await supabase.from('customer_addresses').select('id, state').in('id', addrIds);
      const stateMap = {}; for (const a of (addrs || [])) stateMap[a.id] = a.state;
      for (const o of list) {
        const st = stateMap[o.shipping_address_id] || 'Unknown';
        if (!byState[st]) byState[st] = { state: st, total: 0, returned: 0 };
        byState[st].total++; if (o.order_status === 'returned') byState[st].returned++;
      }
    }
  }

  // By campaign
  const byCampaign = {};
  const campIds = list.map(o => o.source_campaign_id).filter(Boolean);
  let campNames = {};
  if (campIds.length > 0) {
    const { data: camps } = await supabase.from('campaigns').select('id, campaign_name').in('id', [...new Set(campIds)]);
    for (const c of (camps || [])) campNames[c.id] = c.campaign_name;
  }
  for (const o of list) {
    const cid = o.source_campaign_id || 'none';
    const name = campNames[cid] || (cid === 'none' ? 'Unattributed' : 'Unknown');
    if (!byCampaign[cid]) byCampaign[cid] = { campaign_name: name, total: 0, returned: 0 };
    byCampaign[cid].total++; if (o.order_status === 'returned') byCampaign[cid].returned++;
  }

  const addRate = (obj) => ({ ...obj, return_rate: safeDivide(obj.returned, obj.total) });

  return {
    total_cod_orders, total_cod_amount, cod_collected, cod_pending, cod_returned,
    cod_collected_amount, cod_pending_amount,
    cod_return_rate: safeDivide(cod_returned, total_cod_orders),
    cod_delivery_rate: safeDivide(cod_collected, total_cod_orders),
    shipping_cost_lost,
    by_state: Object.values(byState).map(addRate),
    by_campaign: Object.values(byCampaign).map(addRate),
  };
};

// ─── 6. Stock Summary ────────────────────────────────────────

const getStockSummary = async () => {
  const { data: stock, error } = await supabase.from('stock')
    .select('*, product:products(id, product_name, sku), location:storage_locations(id, location_name)');
  if (error) throw new BadRequestError(`Failed: ${error.message}`);

  let total_items = 0, total_quantity = 0, low_stock_count = 0;
  for (const item of (stock || [])) {
    total_items++; total_quantity += item.quantity || 0;
    if (item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold) low_stock_count++;
  }
  return { total_items, total_quantity, low_stock_count, items: stock || [] };
};

// ─── 7. Business Overview ────────────────────────────────────

const getBusinessOverview = async (dateFrom, dateTo) => {
  const [orderStats, codAnalytics, stockSummary] = await Promise.all([
    getOrderStats(dateFrom, dateTo), getCodAnalytics(dateFrom, dateTo), getStockSummary(),
  ]);

  let adQuery = supabase.from('campaign_daily_spend').select('amount_spent, date');
  if (dateFrom) adQuery = adQuery.gte('date', dateFrom);
  if (dateTo) adQuery = adQuery.lte('date', dateTo);
  const { data: adData } = await adQuery;
  const total_ad_spend = roundMoney(sumField(adData, 'amount_spent'));

  // Monthly revenue
  let allQuery = supabase.from('orders').select('total_amount, order_source, order_date');
  if (dateFrom) allQuery = allQuery.gte('order_date', dateFrom);
  if (dateTo) allQuery = allQuery.lte('order_date', dateTo);
  const { data: allOrders } = await allQuery;

  const monthlyRev = {};
  for (const o of (allOrders || [])) {
    const m = o.order_date?.slice(0, 7); if (!m) continue;
    if (!monthlyRev[m]) monthlyRev[m] = { month: m, total: 0, facebook_ad: 0, shopee: 0, agent: 0, other: 0 };
    const amt = parseFloat(o.total_amount || 0);
    monthlyRev[m].total = roundMoney(monthlyRev[m].total + amt);
    if (['facebook_ad', 'shopee', 'agent'].includes(o.order_source)) monthlyRev[m][o.order_source] = roundMoney(monthlyRev[m][o.order_source] + amt);
    else monthlyRev[m].other = roundMoney(monthlyRev[m].other + amt);
  }

  const monthlyAd = {};
  for (const r of (adData || [])) { const m = r.date?.slice(0, 7); if (m) monthlyAd[m] = roundMoney((monthlyAd[m] || 0) + parseFloat(r.amount_spent || 0)); }

  // Top products
  const { data: allItems } = await supabase.from('order_items').select('item_name, quantity, line_total');
  const prodMap = {};
  for (const i of (allItems || [])) {
    const n = i.item_name || 'Unknown';
    if (!prodMap[n]) prodMap[n] = { product_name: n, qty_sold: 0, revenue: 0 };
    prodMap[n].qty_sold += (i.quantity || 0); prodMap[n].revenue = roundMoney(prodMap[n].revenue + parseFloat(i.line_total || 0));
  }

  // Customer growth
  const { data: customers } = await supabase.from('customers').select('created_at, total_orders');
  const custGrowth = {};
  let totalCust = 0, repeatCust = 0;
  for (const c of (customers || [])) {
    totalCust++; if ((c.total_orders || 0) > 1) repeatCust++;
    const m = c.created_at?.slice(0, 7); if (m) custGrowth[m] = (custGrowth[m] || 0) + 1;
  }

  return {
    orders: orderStats,
    cod: { total_cod_orders: codAnalytics.total_cod_orders, cod_collected: codAnalytics.cod_collected, cod_returned: codAnalytics.cod_returned, cod_return_rate: codAnalytics.cod_return_rate, shipping_cost_lost: codAnalytics.shipping_cost_lost },
    stock: { total_items: stockSummary.total_items, total_quantity: stockSummary.total_quantity, low_stock_count: stockSummary.low_stock_count },
    ad_spend: total_ad_spend,
    roas: safeDivide(orderStats.total_revenue, total_ad_spend),
    monthly_revenue: Object.values(monthlyRev).sort((a, b) => a.month.localeCompare(b.month)),
    monthly_ad_spend_vs_revenue: Object.keys(monthlyRev).sort().map(m => ({ month: m, ad_spend: monthlyAd[m] || 0, revenue: monthlyRev[m].total, roas: safeDivide(monthlyRev[m].total, monthlyAd[m] || 0) })),
    top_products: Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 20),
    customer_growth: Object.entries(custGrowth).sort().map(([month, count]) => ({ month, new_customers: count })),
    repeat_rate: safeDivide(repeatCust, totalCust),
    total_customers: totalCust,
  };
};

module.exports = { getDailySummary, getDailyTrend, getOrderStats, getCampaignPerformance, getCodAnalytics, getStockSummary, getBusinessOverview };

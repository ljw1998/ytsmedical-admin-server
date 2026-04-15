const supabase = require('../config/database');
const { NotFoundError, ConflictError } = require('../utils/errors');

class CampaignsService {
  async list({ page = 1, limit = 20, search = '', status = null, platform = null, objective = null }) {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('campaigns')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`campaign_name.ilike.%${search}%,meta_campaign_id.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (platform) {
      query = query.eq('platform', platform);
    }

    if (objective) {
      query = query.eq('objective', objective);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getById(id) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Campaign not found');
    }

    // Get spend summary
    const { data: spendData, error: spendError } = await supabase
      .from('campaign_daily_spend')
      .select('amount_spent, date')
      .eq('campaign_id', id);

    if (!spendError && spendData) {
      const totalSpent = spendData.reduce((sum, row) => sum + parseFloat(row.amount_spent || 0), 0);
      const daysWithSpend = spendData.length;

      data.spend_summary = {
        total_spent: Math.round(totalSpent * 100) / 100,
        days_with_spend: daysWithSpend,
        avg_daily_spend: daysWithSpend > 0 ? Math.round((totalSpent / daysWithSpend) * 100) / 100 : 0,
      };
    }

    return data;
  }

  async checkMetaCampaignIdUniqueness(metaCampaignId, excludeId = null) {
    if (!metaCampaignId) return;

    let query = supabase
      .from('campaigns')
      .select('id')
      .eq('meta_campaign_id', metaCampaignId);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      throw new ConflictError(`Campaign with meta_campaign_id "${metaCampaignId}" already exists`);
    }
  }

  async create(campaignData) {
    await this.checkMetaCampaignIdUniqueness(campaignData.meta_campaign_id);

    const insertData = {
      campaign_name: campaignData.campaign_name,
      meta_campaign_id: campaignData.meta_campaign_id || null,
      platform: campaignData.platform || null,
      objective: campaignData.objective || null,
      start_date: campaignData.start_date || null,
      end_date: campaignData.end_date || null,
      status: campaignData.status || 'active',
      notes: campaignData.notes || null,
    };

    const { data, error } = await supabase
      .from('campaigns')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async update(id, campaignData) {
    await this.getById(id);

    if (campaignData.meta_campaign_id !== undefined) {
      await this.checkMetaCampaignIdUniqueness(campaignData.meta_campaign_id, id);
    }

    const updateFields = {};
    if (campaignData.campaign_name !== undefined) updateFields.campaign_name = campaignData.campaign_name;
    if (campaignData.meta_campaign_id !== undefined) updateFields.meta_campaign_id = campaignData.meta_campaign_id;
    if (campaignData.platform !== undefined) updateFields.platform = campaignData.platform;
    if (campaignData.objective !== undefined) updateFields.objective = campaignData.objective;
    if (campaignData.start_date !== undefined) updateFields.start_date = campaignData.start_date;
    if (campaignData.end_date !== undefined) updateFields.end_date = campaignData.end_date;
    if (campaignData.status !== undefined) updateFields.status = campaignData.status;
    if (campaignData.notes !== undefined) updateFields.notes = campaignData.notes;

    const { data, error } = await supabase
      .from('campaigns')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async delete(id) {
    await this.getById(id);

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { id };
  }
}

module.exports = new CampaignsService();

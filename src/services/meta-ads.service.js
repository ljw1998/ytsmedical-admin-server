const axios = require('axios');
const supabase = require('../config/database');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');

const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Map Meta's effective_status to our campaign status
const mapMetaStatus = (effectiveStatus) => {
  switch (effectiveStatus) {
    case 'ACTIVE':
    case 'IN_PROCESS':
    case 'WITH_ISSUES':
      return 'active';
    case 'PAUSED':
      return 'inactive';
    case 'DELETED':
    case 'ARCHIVED':
      return 'archived';
    default:
      return null; // Don't change if unknown
  }
};

class MetaAdsService {
  // ─── Ad Accounts CRUD ──────────────────────────────────────

  async listAdAccounts() {
    const { data, error } = await supabase
      .from('meta_ad_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data;
  }

  async createAdAccount(accountData) {
    // Check uniqueness of ad_account_id
    const { data: existing } = await supabase
      .from('meta_ad_accounts')
      .select('id')
      .eq('ad_account_id', accountData.ad_account_id);

    if (existing && existing.length > 0) {
      throw new ConflictError(`Ad account with ID "${accountData.ad_account_id}" already exists`);
    }

    const insertData = {
      client_name: accountData.client_name,
      ad_account_id: accountData.ad_account_id,
      ad_account_name: accountData.ad_account_name || null,
      is_active: accountData.is_active !== undefined ? accountData.is_active : true,
    };

    const { data, error } = await supabase
      .from('meta_ad_accounts')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async updateAdAccount(id, accountData) {
    // Check exists
    const { data: existing, error: findError } = await supabase
      .from('meta_ad_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      throw new NotFoundError('Ad account not found');
    }

    // Check uniqueness if ad_account_id changed
    if (accountData.ad_account_id !== undefined && accountData.ad_account_id !== existing.ad_account_id) {
      const { data: dup } = await supabase
        .from('meta_ad_accounts')
        .select('id')
        .eq('ad_account_id', accountData.ad_account_id)
        .neq('id', id);

      if (dup && dup.length > 0) {
        throw new ConflictError(`Ad account with ID "${accountData.ad_account_id}" already exists`);
      }
    }

    const updateFields = {};
    if (accountData.client_name !== undefined) updateFields.client_name = accountData.client_name;
    if (accountData.ad_account_id !== undefined) updateFields.ad_account_id = accountData.ad_account_id;
    if (accountData.ad_account_name !== undefined) updateFields.ad_account_name = accountData.ad_account_name;
    if (accountData.is_active !== undefined) updateFields.is_active = accountData.is_active;

    const { data, error } = await supabase
      .from('meta_ad_accounts')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async deleteAdAccount(id) {
    const { data: existing, error: findError } = await supabase
      .from('meta_ad_accounts')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      throw new NotFoundError('Ad account not found');
    }

    const { error } = await supabase
      .from('meta_ad_accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { id };
  }

  // ─── Meta API Sync ─────────────────────────────────────────

  parseActions(actions) {
    const mapping = {
      'messaging_first_reply': 'new_messaging_contacts',
      'messaging_conversation_started_7d': 'messaging_conversations_started',
      'total_messaging_connection': 'total_messaging_connections',
      'link_click': 'link_clicks',
      'post_engagement': 'post_engagements',
      'page_engagement': 'page_engagements',
      'lead': 'leads',
      'onsite_conversion.lead': 'onsite_leads',
      'video_view': 'video_views',
      'post_reaction': 'post_reactions',
    };

    const result = {};
    Object.values(mapping).forEach((field) => {
      result[field] = 0;
    });

    if (!actions || !Array.isArray(actions)) return result;

    for (const action of actions) {
      const mappedField = mapping[action.action_type];
      if (mappedField) {
        result[mappedField] = parseInt(action.value, 10) || 0;
      }
    }

    return result;
  }

  async syncDailySpend(adAccountId, since, until, syncType, userId = null) {
    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('ad_spend_sync_logs')
      .insert({
        ad_account_id: adAccountId,
        sync_type: syncType,
        sync_start_date: since,
        sync_end_date: until,
        status: 'success',
        triggered_by: userId || null,
      })
      .select()
      .single();

    if (logError) throw logError;

    const syncLogId = syncLog.id;
    let totalRowsUpserted = 0;
    let totalCampaignsCreated = 0;

    try {
      const accessToken = process.env.META_SYSTEM_USER_TOKEN;
      if (!accessToken) {
        throw new BadRequestError('META_SYSTEM_USER_TOKEN is not configured');
      }

      const accountIdForApi = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

      let url = `${META_BASE_URL}/${accountIdForApi}/insights`;
      const params = {
        level: 'campaign',
        time_increment: 1,
        time_range: JSON.stringify({ since, until }),
        fields: 'campaign_name,campaign_id,spend,reach,impressions,cpm,ctr,frequency,actions,cost_per_action_type,purchase_roas',
        access_token: accessToken,
        limit: 500,
      };

      let hasMore = true;

      while (hasMore) {
        const response = await axios.get(url, { params: hasMore === true ? params : undefined });
        const responseData = response.data;
        const rows = responseData.data || [];

        for (const row of rows) {
          const metaCampaignId = row.campaign_id;
          const campaignName = row.campaign_name;
          const date = row.date_start;

          // Find or create campaign record
          let { data: campaign } = await supabase
            .from('campaigns')
            .select('id')
            .eq('meta_campaign_id', metaCampaignId)
            .single();

          if (!campaign) {
            const { data: newCampaign, error: createError } = await supabase
              .from('campaigns')
              .insert({
                campaign_name: campaignName,
                meta_campaign_id: metaCampaignId,
                ad_account_id: adAccountId,
                status: 'active',
              })
              .select('id')
              .single();

            if (createError) throw createError;
            campaign = newCampaign;
            totalCampaignsCreated++;
          } else {
            // Update campaign name in case it was renamed in Meta
            await supabase
              .from('campaigns')
              .update({ campaign_name: campaignName, ad_account_id: adAccountId })
              .eq('id', campaign.id);
          }

          // Parse actions
          const actionMetrics = this.parseActions(row.actions);

          // Parse cost_per_action_type for cost_per_result
          let costPerResult = null;
          if (row.cost_per_action_type && Array.isArray(row.cost_per_action_type)) {
            const primaryAction = row.cost_per_action_type[0];
            if (primaryAction) {
              costPerResult = parseFloat(primaryAction.value) || null;
            }
          }

          // Parse purchase_roas
          let metaRoas = null;
          if (row.purchase_roas && Array.isArray(row.purchase_roas)) {
            const primaryRoas = row.purchase_roas[0];
            if (primaryRoas) {
              metaRoas = parseFloat(primaryRoas.value) || null;
            }
          }

          const upsertData = {
            campaign_id: campaign.id,
            meta_campaign_id: metaCampaignId,
            date: date,
            amount_spent: parseFloat(row.spend) || 0,
            reach: parseInt(row.reach, 10) || 0,
            impressions: parseInt(row.impressions, 10) || 0,
            cpm: parseFloat(row.cpm) || 0,
            ctr: parseFloat(row.ctr) || 0,
            frequency: parseFloat(row.frequency) || 0,
            cost_per_result: costPerResult,
            meta_roas: metaRoas,
            raw_actions: row.actions || null,
            sync_log_id: syncLogId,
            ...actionMetrics,
            updated_at: new Date().toISOString(),
          };

          const { error: upsertError } = await supabase
            .from('campaign_daily_spend')
            .upsert(upsertData, { onConflict: 'campaign_id,date' });

          if (upsertError) throw upsertError;
          totalRowsUpserted++;
        }

        // Handle pagination
        if (responseData.paging && responseData.paging.next) {
          url = responseData.paging.next;
          hasMore = 'next';
        } else {
          hasMore = false;
        }
      }

      // Sync campaign statuses from Meta Campaign API (separate from insights)
      try {
        const campaignsUrl = `${META_BASE_URL}/${accountIdForApi}/campaigns`;
        const campaignsResponse = await axios.get(campaignsUrl, {
          params: {
            fields: 'id,name,effective_status',
            limit: 500,
            access_token: accessToken,
          },
        });

        for (const mc of (campaignsResponse.data?.data || [])) {
          const mapped = mapMetaStatus(mc.effective_status);
          const { data: existingCampaign } = await supabase
            .from('campaigns')
            .select('id')
            .eq('meta_campaign_id', mc.id)
            .maybeSingle();
          if (existingCampaign) {
            const updateFields = { ad_account_id: adAccountId };
            if (mapped) updateFields.status = mapped;
            if (mc.name) updateFields.campaign_name = mc.name;
            await supabase
              .from('campaigns')
              .update(updateFields)
              .eq('id', existingCampaign.id);
          } else {
            await supabase.from('campaigns').insert({
              campaign_name: mc.name,
              meta_campaign_id: mc.id,
              ad_account_id: adAccountId,
              status: mapped || 'inactive',
            });
          }
        }
      } catch (statusErr) {
        console.error('Campaign status sync failed (non-fatal):', statusErr.message);
      }

      // Update sync log with success
      await supabase
        .from('ad_spend_sync_logs')
        .update({
          rows_upserted: totalRowsUpserted,
          campaigns_created: totalCampaignsCreated,
          status: 'success',
        })
        .eq('id', syncLogId);

      // Update ad account last sync info
      await supabase
        .from('meta_ad_accounts')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'success',
          last_sync_rows: totalRowsUpserted,
        })
        .eq('ad_account_id', adAccountId);

      return {
        sync_log_id: syncLogId,
        rows_upserted: totalRowsUpserted,
        campaigns_created: totalCampaignsCreated,
        status: 'success',
      };
    } catch (error) {
      let errMsg = error.message;
      if (error.response) {
        const meta = error.response.data?.error;
        if (meta) {
          errMsg = `Meta API ${error.response.status}: ${meta.message || ''}` +
            (meta.error_user_title ? ` | ${meta.error_user_title}` : '') +
            (meta.error_user_msg ? ` — ${meta.error_user_msg}` : '') +
            (meta.code ? ` (code ${meta.code}${meta.error_subcode ? `/${meta.error_subcode}` : ''})` : '') +
            (meta.fbtrace_id ? ` [fbtrace_id ${meta.fbtrace_id}]` : '');
        } else {
          errMsg = `HTTP ${error.response.status}: ${JSON.stringify(error.response.data).slice(0, 1000)}`;
        }
      }

      await supabase
        .from('ad_spend_sync_logs')
        .update({
          rows_upserted: totalRowsUpserted,
          campaigns_created: totalCampaignsCreated,
          status: totalRowsUpserted > 0 ? 'partial' : 'failed',
          error_message: errMsg,
        })
        .eq('id', syncLogId);

      // Update ad account last sync info
      await supabase
        .from('meta_ad_accounts')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: totalRowsUpserted > 0 ? 'partial' : 'failed',
          last_sync_rows: totalRowsUpserted,
        })
        .eq('ad_account_id', adAccountId);

      throw error;
    }
  }

  async syncAllAccounts() {
    const { data: accounts, error } = await supabase
      .from('meta_ad_accounts')
      .select('ad_account_id')
      .eq('is_active', true);

    if (error) throw error;

    const results = [];
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const since = sevenDaysAgo.toISOString().slice(0, 10);
    const until = today.toISOString().slice(0, 10);

    for (const account of accounts) {
      try {
        const result = await this.syncDailySpend(account.ad_account_id, since, until, 'daily_cron');
        results.push({ ad_account_id: account.ad_account_id, ...result });
      } catch (err) {
        console.error(`Sync failed for account ${account.ad_account_id}:`, err.message);
        results.push({
          ad_account_id: account.ad_account_id,
          status: 'failed',
          error: err.message,
        });
      }
    }

    return results;
  }

  // ─── Sync Logs ─────────────────────────────────────────────

  async listSyncLogs({ page = 1, limit = 20, ad_account_id = null, status = null }) {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('ad_spend_sync_logs')
      .select('*', { count: 'exact' });

    if (ad_account_id) {
      query = query.eq('ad_account_id', ad_account_id);
    }

    if (status) {
      query = query.eq('status', status);
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

  // ─── Daily Spend ───────────────────────────────────────────

  async getDailySpend({ page = 1, limit = 20, campaign_id = null, ad_account_id = null, date_from = null, date_to = null }) {
    const offset = (page - 1) * limit;

    const campaignSelect = ad_account_id
      ? 'campaigns!inner(id, campaign_name, meta_campaign_id, ad_account_id)'
      : 'campaigns(id, campaign_name, meta_campaign_id)';

    let query = supabase
      .from('campaign_daily_spend')
      .select(`*, ${campaignSelect}`, { count: 'exact' });

    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }

    if (ad_account_id) {
      query = query.eq('campaigns.ad_account_id', ad_account_id);
    }

    if (date_from) {
      query = query.gte('date', date_from);
    }

    if (date_to) {
      query = query.lte('date', date_to);
    }

    query = query
      .order('date', { ascending: false })
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
}

module.exports = new MetaAdsService();

const crypto = require('crypto');
const axios = require('axios');
const supabase = require('../config/database');
const { storageBuckets, getPublicUrl } = require('../config/storage');
const {
  NINJAVAN_EVENT_STATUS_MAP,
  NINJAVAN_NOTE_EVENTS,
  NINJAVAN_DELIVERED_EVENTS,
  NINJAVAN_PICKUP_EXCEPTION_EVENTS,
  NINJAVAN_DELIVERY_EXCEPTION_EVENTS,
} = require('../config/constants');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class NinjaVanService {
  constructor() {
    this.baseUrl = process.env.NINJAVAN_BASE_URL;
    this.clientId = process.env.NINJAVAN_CLIENT_ID;
    this.clientSecret = process.env.NINJAVAN_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Get OAuth 2.0 access token, persisted in Supabase so only one token
   * is ever active (survives restarts and is shared across instances).
   */
  async getAccessToken() {
    const now = Date.now();

    // 1. Return in-memory cache if still valid
    if (this.accessToken && this.tokenExpiresAt && now < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // 2. Check Supabase for a persisted token that is still valid
    const { data: cached } = await supabase
      .from('ninjavan_tokens')
      .select('access_token, expires_at')
      .eq('client_id', this.clientId)
      .single();

    if (cached && new Date(cached.expires_at).getTime() > now) {
      this.accessToken = cached.access_token;
      this.tokenExpiresAt = new Date(cached.expires_at).getTime();
      return this.accessToken;
    }

    // 3. No valid token anywhere — request a new one from NinjaVan
    const response = await axios.post(`${this.baseUrl}/2.0/oauth/access_token`, {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
    });

    this.accessToken = response.data.access_token;
    // Cache with 5-minute buffer before expiry
    const expiresInMs = (response.data.expires_in || 3600) * 1000;
    this.tokenExpiresAt = now + expiresInMs - 5 * 60 * 1000;
    const expiresAtIso = new Date(this.tokenExpiresAt).toISOString();

    // 4. Persist to Supabase (upsert keyed on client_id)
    await supabase
      .from('ninjavan_tokens')
      .upsert(
        {
          client_id: this.clientId,
          access_token: this.accessToken,
          expires_at: expiresAtIso,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' }
      );

    return this.accessToken;
  }

  /**
   * Build authorization headers for NinjaVan API requests
   */
  async getAuthHeaders() {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create an order in NinjaVan
   * @param {Object} order - Order record from DB
   * @param {Object} customer - Customer record
   * @param {Object} shippingAddress - Customer address record
   * @param {Object} fulfilmentLocation - Storage location record (used as "from" address)
   * @returns {{ tracking_number: string, requested_tracking_number: string }}
   */
  async createOrder(order, customer, shippingAddress, fulfilmentLocation) {
    let headers = await this.getAuthHeaders();

    const requestedTrackingNum = order.order_number
      ? order.order_number.replace(/[^a-zA-Z0-9]/g, '').slice(-9)
      : undefined;

    const requestBody = {
      service_type: 'Parcel',
      service_level: 'Standard',
      requested_tracking_number: requestedTrackingNum,
      reference: {
        merchant_order_number: order.order_number || requestedTrackingNum,
      },
      from: {
        name: fulfilmentLocation.location_name || 'Wilson BMS',
        phone_number: fulfilmentLocation.phone || fulfilmentLocation.contact_phone || '',
        email: fulfilmentLocation.email || '',
        address: {
          address1: fulfilmentLocation.address_line_1 || fulfilmentLocation.address_line1 || '',
          address2: fulfilmentLocation.address_line_2 || fulfilmentLocation.address_line2 || '',
          city: fulfilmentLocation.city || '',
          state: fulfilmentLocation.state || '',
          postcode: fulfilmentLocation.postcode || '',
          country: fulfilmentLocation.country || 'MY',
        },
      },
      to: {
        name: customer.name || '',
        phone_number: customer.phone || '',
        email: customer.email || '',
        address: {
          address1: shippingAddress.address_line_1 || shippingAddress.address_line1 || '',
          address2: shippingAddress.address_line_2 || shippingAddress.address_line2 || '',
          city: shippingAddress.city || '',
          state: shippingAddress.state || '',
          postcode: shippingAddress.postcode || '',
          country: shippingAddress.country || 'MY',
        },
      },
      parcel_job: {
        is_pickup_required: true,
        pickup_service_type: 'Scheduled',
        pickup_service_level: 'Standard',
        pickup_date: order.pickup_date || (() => {
          const d = new Date(); d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })(),
        pickup_timeslot: {
          start_time: process.env.NINJAVAN_DEFAULT_PICKUP_TIMESLOT_START || '09:00',
          end_time: process.env.NINJAVAN_DEFAULT_PICKUP_TIMESLOT_END || '18:00',
          timezone: process.env.NINJAVAN_TIMEZONE || 'Asia/Kuala_Lumpur',
        },
        pickup_instructions: order.pickup_instructions || undefined,
        delivery_instructions: order.delivery_instructions || undefined,
        delivery_start_date: order.pickup_date || (() => {
          const d = new Date(); d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })(),
        delivery_timeslot: {
          start_time: '09:00',
          end_time: '22:00',
          timezone: process.env.NINJAVAN_TIMEZONE || 'Asia/Kuala_Lumpur',
        },
        dimensions: {
          weight: order.weight || 1,
          ...(order.parcel_length ? { length: order.parcel_length } : {}),
          ...(order.parcel_width ? { width: order.parcel_width } : {}),
          ...(order.parcel_height ? { height: order.parcel_height } : {}),
        },
        items: (order.items || []).map((item) => ({
          item_description: item.item_name || 'Product',
          quantity: item.quantity || 1,
          is_dangerous_good: false,
        })),
      },
    };

    // Include COD fields only if payment_type is 'cod'
    if (order.payment_type === 'cod') {
      requestBody.parcel_job.cash_on_delivery = parseFloat(order.total_amount) || 0;
      requestBody.parcel_job.cash_on_delivery_currency = 'MYR';
    }

    let lastError;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/4.2/orders`,
          requestBody,
          { headers }
        );

        const trackingNumber = response.data.tracking_number || response.data.tracking_id;
        const requestedTrackingNumber = response.data.requested_tracking_number || order.order_number;

        // Update order with NinjaVan tracking info
        await supabase
          .from('orders')
          .update({
            tracking_number: trackingNumber,
            ninjavan_requested_tracking_number: requestedTrackingNumber,
            ninjavan_sync_failed: false,
            ninjavan_sync_error: null,
          })
          .eq('id', order.id);

        return { tracking_number: trackingNumber, requested_tracking_number: requestedTrackingNumber };
      } catch (error) {
        lastError = error;

        // 400 = validation error, don't retry
        if (error.response && error.response.status === 400) {
          const errData = error.response.data;
          let errorMsg;
          if (typeof errData === 'string') {
            errorMsg = errData;
          } else if (errData?.error?.details?.length) {
            errorMsg = errData.error.details.map(d => `${d.field}: ${d.message}`).join('; ');
          } else {
            errorMsg = errData?.error?.message || errData?.message || JSON.stringify(errData);
          }

          await supabase
            .from('orders')
            .update({
              ninjavan_sync_failed: true,
              ninjavan_sync_error: errorMsg,
            })
            .eq('id', order.id);

          throw new BadRequestError(`NinjaVan validation error: ${errorMsg}`);
        }

        // 401 = token expired/invalid, clear cached token and retry with a fresh one
        if (error.response && error.response.status === 401) {
          this.accessToken = null;
          this.tokenExpiresAt = null;
          await supabase.from('ninjavan_tokens').delete().eq('client_id', this.clientId);
          headers = await this.getAuthHeaders();
        }

        // 5xx or other server errors: retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted - flag sync as failed
    const errorMsg = lastError?.response?.data?.message || lastError?.message || 'Unknown NinjaVan error';

    await supabase
      .from('orders')
      .update({
        ninjavan_sync_failed: true,
        ninjavan_sync_error: `Failed after ${maxRetries} attempts: ${errorMsg}`,
      })
      .eq('id', order.id);

    throw new BadRequestError(`NinjaVan order creation failed after ${maxRetries} attempts: ${errorMsg}`);
  }

  /**
   * Generate waybill PDF for a tracking number
   * @param {string} trackingNumber
   * @returns {Buffer} PDF buffer
   */
  async generateWaybill(trackingNumber) {
    let headers = await this.getAuthHeaders();

    let response;
    try {
      response = await axios.get(
        `${this.baseUrl}/2.0/reports/waybill`,
        {
          params: { tid: trackingNumber },
          headers,
          responseType: 'arraybuffer',
        }
      );
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.accessToken = null;
        this.tokenExpiresAt = null;
        headers = await this.getAuthHeaders();
        response = await axios.get(
          `${this.baseUrl}/2.0/reports/waybill`,
          {
            params: { tid: trackingNumber },
            headers,
            responseType: 'arraybuffer',
          }
        );
      } else {
        throw error;
      }
    }

    const pdfBuffer = Buffer.from(response.data);

    // Cache in Supabase Storage 'waybills' bucket
    const filePath = `${trackingNumber}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(storageBuckets.waybills.name)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Waybill upload error:', uploadError.message);
    } else {
      // Store the waybill URL on the order
      const waybillUrl = getPublicUrl(storageBuckets.waybills.name, filePath);

      await supabase
        .from('orders')
        .update({ ninjavan_waybill_url: waybillUrl })
        .eq('tracking_number', trackingNumber);
    }

    return pdfBuffer;
  }

  /**
   * Cancel a NinjaVan order
   * @param {string} trackingNumber
   */
  async cancelOrder(trackingNumber) {
    let headers = await this.getAuthHeaders();

    let response;
    try {
      response = await axios.delete(
        `${this.baseUrl}/2.2/orders/${trackingNumber}`,
        { headers }
      );
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.accessToken = null;
        this.tokenExpiresAt = null;
        headers = await this.getAuthHeaders();
        response = await axios.delete(
          `${this.baseUrl}/2.2/orders/${trackingNumber}`,
          { headers }
        );
      } else {
        throw error;
      }
    }

    return response.data;
  }

  /**
   * Verify HMAC-SHA256 webhook signature
   * @param {string|Buffer} rawBody - Raw request body
   * @param {string} signature - Signature from header
   * @returns {boolean}
   */
  verifySignature(rawBody, signature) {
    if (!signature || !this.clientSecret) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', this.clientSecret);
    hmac.update(rawBody);
    const computedSignature = hmac.digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  }

  /**
   * Process an incoming NinjaVan V2 webhook
   * V2 payload structure: { tracking_id, shipper_order_ref_no, timestamp, event, status,
   *   is_parcel_on_rts_leg, delivery_information, delivery_exception, pickup_exception,
   *   parcel_measurements_information, cancellation_information, rts_reason, ... }
   */
  async processWebhook(payload, signature, rawBody) {
    // V2 fields
    const trackingNumber = payload.tracking_id || null;
    const shipperRef = payload.shipper_order_ref_no || null;
    const eventName = payload.event || null;  // V2: use 'event' (full event name)
    const eventTimestamp = payload.timestamp || null;
    const isRts = payload.is_parcel_on_rts_leg || false;

    // Verify signature
    let signatureValid = false;
    try {
      signatureValid = this.verifySignature(rawBody, signature);
    } catch (err) {
      console.error('Signature verification error:', err.message);
    }

    // Look up order by tracking_number or shipper_order_ref_no
    let order = null;
    let orderId = null;

    if (trackingNumber) {
      const { data } = await supabase
        .from('orders')
        .select('id, order_status, payment_type, payment_status, tracking_number')
        .or(`tracking_number.eq.${trackingNumber},ninjavan_requested_tracking_number.eq.${trackingNumber}`)
        .single();

      if (data) {
        order = data;
        orderId = data.id;
      }
    }

    // Fallback: try shipper_order_ref_no if no match by tracking_id
    if (!order && shipperRef) {
      const { data } = await supabase
        .from('orders')
        .select('id, order_status, payment_type, payment_status, tracking_number')
        .eq('ninjavan_requested_tracking_number', shipperRef)
        .single();

      if (data) {
        order = data;
        orderId = data.id;
      }
    }

    // Classify event
    const mappedStatus = NINJAVAN_EVENT_STATUS_MAP[eventName] || null;
    const isNoteEvent = NINJAVAN_NOTE_EVENTS.includes(eventName);
    const isDeliveredEvent = NINJAVAN_DELIVERED_EVENTS.includes(eventName);
    const isPickupException = NINJAVAN_PICKUP_EXCEPTION_EVENTS.includes(eventName);
    const isDeliveryException = NINJAVAN_DELIVERY_EXCEPTION_EVENTS.includes(eventName);

    let processingStatus = 'success';
    let errorMessage = null;

    try {
      if (!signatureValid) {
        processingStatus = 'ignored';
        errorMessage = 'Invalid webhook signature';
      } else if (!trackingNumber) {
        processingStatus = 'ignored';
        errorMessage = 'No tracking number in payload';
      } else if (!order) {
        processingStatus = 'ignored';
        errorMessage = `No order found for tracking number: ${trackingNumber}`;
      } else if (isNoteEvent) {
        // --- Note events: don't change status, store exception details ---
        const orderUpdate = {
          is_rts: isRts,
          ninjavan_event_timestamp: eventTimestamp,
        };

        // Store pickup failure reason
        if (isPickupException && payload.pickup_exception) {
          orderUpdate.pickup_failure_reason = payload.pickup_exception.failure_reason || null;
        }

        // Store delivery failure reason + proof
        if (isDeliveryException && payload.delivery_exception) {
          orderUpdate.delivery_failure_reason = payload.delivery_exception.failure_reason || null;
          if (payload.delivery_exception.proof) {
            orderUpdate.delivery_proof = payload.delivery_exception.proof;
          }
        }

        // Store RTS reason
        if (payload.rts_reason) {
          orderUpdate.rts_reason = payload.rts_reason;
        }

        await supabase.from('orders').update(orderUpdate).eq('id', orderId);

        const failureReason = payload.pickup_exception?.failure_reason
          || payload.delivery_exception?.failure_reason
          || payload.rts_reason || '';

        await supabase.from('order_status_history').insert({
          order_id: orderId,
          previous_status: order.order_status,
          new_status: order.order_status,
          source: 'ninjavan_webhook',
          ninjavan_event: eventName,
          raw_payload: payload,
          notes: `${eventName}${failureReason ? ': ' + failureReason : ''}`,
        });

      } else if (mappedStatus) {
        // --- Status-changing events ---
        const orderPreviousStatus = order.order_status;
        const eventDate = eventTimestamp
          ? new Date(eventTimestamp).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        const orderUpdate = {
          order_status: mappedStatus,
          is_rts: isRts,
          ninjavan_event_timestamp: eventTimestamp,
        };

        // Auto-set dates
        if (mappedStatus === 'in_transit') {
          orderUpdate.shipped_date = eventDate;
        }
        if (mappedStatus === 'delivered') {
          orderUpdate.delivered_date = eventDate;
        }

        // Store delivery proof (photos, signature) on delivered events
        if (isDeliveredEvent && payload.delivery_information?.proof) {
          orderUpdate.delivery_proof = payload.delivery_information.proof;
        }

        // Store return reason
        if (eventName === 'Returned to Sender') {
          orderUpdate.rts_reason = payload.rts_reason || null;
          orderUpdate.return_reason = payload.rts_reason || 'Returned to sender by NinjaVan';
          if (payload.delivery_information?.proof) {
            orderUpdate.delivery_proof = payload.delivery_information.proof;
          }
        }

        // Store cancellation reason
        if (eventName === 'Cancelled' && payload.cancellation_information) {
          orderUpdate.cancellation_reason = payload.cancellation_information.reason || null;
        }

        // Lost/Damaged
        if (eventName === 'Delivery Exception, Parcel Lost' || eventName === 'Delivery Exception, Parcel Damaged') {
          orderUpdate.return_reason = payload.delivery_exception?.failure_reason || eventName;
          if (payload.delivery_exception) {
            orderUpdate.delivery_failure_reason = payload.delivery_exception.failure_reason || null;
          }
        }

        await supabase.from('orders').update(orderUpdate).eq('id', orderId);

        // Log status history
        await supabase.from('order_status_history').insert({
          order_id: orderId,
          previous_status: orderPreviousStatus,
          new_status: mappedStatus,
          source: 'ninjavan_webhook',
          ninjavan_event: eventName,
          raw_payload: payload,
          notes: `NinjaVan: ${eventName}`,
        });

        // --- Special event handling ---

        // Pending Pickup → trigger waybill generation
        if (eventName === 'Pending Pickup') {
          try {
            await this.generateWaybill(trackingNumber);
          } catch (waybillErr) {
            console.error('Waybill generation failed:', waybillErr.message);
          }
        }

        // Delivered → if COD, update payment status
        if (isDeliveredEvent && order.payment_type === 'cod') {
          await supabase.from('orders')
            .update({ payment_status: 'cod_collected' })
            .eq('id', orderId);

          await supabase.from('order_payments')
            .update({
              status: 'confirmed',
              payment_date: eventDate,
              confirmed_at: new Date().toISOString(),
            })
            .eq('order_id', orderId)
            .eq('payment_method', 'cod')
            .eq('status', 'pending');
        }

      } else if (eventName === 'Parcel Measurements Update') {
        // --- V2: measurements in parcel_measurements_information ---
        const info = payload.parcel_measurements_information || {};
        const orderUpdate = { ninjavan_event_timestamp: eventTimestamp };

        if (info.weight) {
          orderUpdate.actual_weight = info.weight;
        }
        if (info.dimensions) {
          orderUpdate.actual_dimensions = info.dimensions; // { length, width, height }
        }

        if (Object.keys(orderUpdate).length > 1) {
          await supabase.from('orders').update(orderUpdate).eq('id', orderId);
        }

        await supabase.from('order_status_history').insert({
          order_id: orderId,
          previous_status: order.order_status,
          new_status: order.order_status,
          source: 'ninjavan_webhook',
          ninjavan_event: eventName,
          raw_payload: payload,
          notes: `Weight: ${info.weight || '-'}kg, Dimensions: ${info.dimensions ? `${info.dimensions.length}x${info.dimensions.width}x${info.dimensions.height}cm` : '-'}`,
        });
      } else {
        processingStatus = 'ignored';
        errorMessage = `Unmapped event: ${eventName}`;
      }
    } catch (err) {
      processingStatus = 'failed';
      errorMessage = err.message;
      console.error('Webhook processing error:', err.message);
    }

    // Log to ninjavan_webhook_logs (always, even on failure)
    const { error: logError } = await supabase
      .from('ninjavan_webhook_logs')
      .insert({
        tracking_number: trackingNumber,
        order_id: orderId,
        event_name: eventName,
        previous_status: order ? order.order_status : null,
        new_status: mappedStatus || (order ? order.order_status : null),
        raw_payload: payload,
        signature_valid: signatureValid,
        processing_status: processingStatus,
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Failed to log webhook:', logError.message);
    }

    return { processingStatus, errorMessage };
  }
}

// Export singleton instance
module.exports = new NinjaVanService();

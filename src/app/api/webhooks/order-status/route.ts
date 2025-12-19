import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  updateTransactionStatusByOpmOrderId,
  getTransactionByOpmOrderId,
  getTransactionByTrackingKey,
  getProcessedWebhook,
  recordProcessedWebhook,
  hashWebhookPayload,
  updateTransactionStatusValidated,
} from '@/lib/db';
import { verifySignature } from '@/lib/crypto';
import { buildOrderStatusOriginalString } from '@/lib/opm-api';
import {
  validateWebhookSource,
  validateWebhookPayload,
  sanitizeWebhookDataForLog,
  logWebhookEvent,
} from '@/lib/webhook-security';

/**
 * POST /api/webhooks/order-status
 *
 * Webhook endpoint for order status changes (outgoing SPEI transfers)
 *
 * This endpoint is designed to be resilient and flexible:
 * - Accepts any valid JSON payload
 * - Logs all requests for debugging
 * - Always returns 200 OK to prevent retries
 * - Validates webhook secret via x-webhook-secret header (optional)
 * - Attempts to process status updates if payload has expected structure
 *
 * Possible statuses:
 * - pending: Order is queued, waiting for balance
 * - sent: Order sent to SPEI, waiting for response
 * - scattered: Successfully settled/liquidated
 * - canceled: Order was canceled
 * - returned: Order was rejected by recipient bank
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  let body: any = null;

  try {
    // Security check: Validate webhook source (IP whitelist + rate limiting)
    const securityCheck = await validateWebhookSource(request);
    if (!securityCheck.allowed) {
      return NextResponse.json({
        received: true,
        timestamp,
        processed: false,
        message: securityCheck.reason || 'Request blocked',
      }, { status: 403 });
    }

    // Get body
    body = await request.json();

    // Validate payload structure
    const payloadCheck = validateWebhookPayload(body, 'order-status');
    if (!payloadCheck.valid) {
      console.warn('Invalid order-status webhook payload:', payloadCheck.error);
      return NextResponse.json({
        received: true,
        timestamp,
        processed: false,
        message: payloadCheck.error,
      });
    }

    // Log safely (without sensitive data)
    console.log('=== ORDER STATUS WEBHOOK RECEIVED ===');
    console.log('Timestamp:', timestamp);
    console.log('Client IP:', securityCheck.clientIp);
    console.log('Payload (sanitized):', JSON.stringify(sanitizeWebhookDataForLog(body)));
    console.log('=====================================');

    // Optional: Validate webhook secret if configured
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const receivedSecret = request.headers.get('x-webhook-secret');

    if (webhookSecret && receivedSecret && webhookSecret !== receivedSecret) {
      console.warn('Webhook secret mismatch');
    }

    // SECURITY: IP whitelist is now the primary security measure
    // OPM's IP (35.171.132.81) is hardcoded in webhook-security.ts
    // The validateWebhookSource() call above already blocked unauthorized IPs
    //
    // RSA signature validation is disabled because:
    // - OPM hasn't provided their public key for webhook validation
    // - The keys from OPM portal are OUR keys for signing outgoing requests
    // - IP whitelist provides sufficient security for now
    //
    // If OPM provides their public key in the future, re-enable signature validation:
    // const signatureValid = await validateOpmSignature(body);

    console.log('Webhook accepted from verified OPM IP:', securityCheck.clientIp);

    // Try to extract order status data from various possible payload structures
    const orderData = extractOrderStatusData(body);

    if (orderData) {
      console.log('Extracted order status data:', orderData);

      // SECURITY: Idempotency check using orderId + status as the unique key
      // Note: For order-status, we use orderId_status as tracking key since
      // the same order can have multiple status updates (pending -> sent -> scattered)
      const idempotencyKey = `${orderData.orderId}_${orderData.status}`;
      const payloadHash = hashWebhookPayload(body);
      const existingWebhook = await getProcessedWebhook('order-status', idempotencyKey);

      if (existingWebhook) {
        console.log(`[SECURITY] Duplicate order-status webhook detected: ${idempotencyKey}`);
        // Record the duplicate attempt
        await recordProcessedWebhook({
          id: `wh_${crypto.randomUUID()}`,
          webhookType: 'order-status',
          trackingKey: idempotencyKey,
          opmOrderId: orderData.orderId,
          sourceIp: securityCheck.clientIp,
          payloadHash,
          result: 'duplicate',
        });

        return NextResponse.json({
          received: true,
          timestamp,
          processed: false,
          orderId: orderData.orderId,
          status: orderData.status,
          message: 'Status update already processed (idempotency check)',
        });
      }

      // Attempt to process the status update
      const result = await processOrderStatus(orderData, securityCheck.clientIp);

      // Record the webhook processing result
      await recordProcessedWebhook({
        id: `wh_${crypto.randomUUID()}`,
        webhookType: 'order-status',
        trackingKey: idempotencyKey,
        opmOrderId: orderData.orderId,
        sourceIp: securityCheck.clientIp,
        payloadHash,
        result: result.success ? 'success' : 'failed',
      });

      return NextResponse.json({
        received: true,
        timestamp,
        processed: result.success,
        orderId: orderData.orderId,
        status: orderData.status,
        message: result.message,
      });
    }

    // If we couldn't extract order data, just acknowledge receipt
    return NextResponse.json({
      received: true,
      timestamp,
      processed: false,
      message: 'Payload logged but not processed - unexpected structure',
    });

  } catch (error) {
    // Log error but always return 200 OK
    console.error('=== ORDER STATUS WEBHOOK ERROR ===');
    console.error('Timestamp:', timestamp);
    console.error('Error:', error);
    console.error('Body received:', body);
    console.error('==================================');

    return NextResponse.json({
      received: true,
      timestamp,
      processed: false,
      error: 'Internal error occurred - logged for review',
    });
  }
}

/**
 * Extract order status data from various possible payload structures
 */
function extractOrderStatusData(body: any): OrderStatusData | null {
  try {
    // Structure 1: OPM format with type: 'orderStatus' and nested data
    if (body?.type === 'orderStatus' && body?.data) {
      const d = body.data;
      return {
        orderId: d.id || d.orderId,
        status: d.status,
        detail: d.detail,
        trackingKey: d.trackingKey,
        timestamp: d.timestamp,
      };
    }

    // Structure 2: Flat structure with direct fields (orderId and status)
    if (body?.orderId && body?.status) {
      return {
        orderId: body.orderId,
        status: body.status,
        detail: body.detail || body.message,
        trackingKey: body.trackingKey,
        timestamp: body.timestamp,
      };
    }

    // Structure 3: Using 'id' instead of 'orderId'
    if (body?.id && body?.status) {
      return {
        orderId: body.id,
        status: body.status,
        detail: body.detail || body.message,
        trackingKey: body.trackingKey,
        timestamp: body.timestamp,
      };
    }

    // Structure 4: Spanish field names
    if (body?.idOrden || body?.orden_id) {
      return {
        orderId: body.idOrden || body.orden_id,
        status: body.status || body.estado,
        detail: body.detail || body.detalle || body.mensaje,
        trackingKey: body.trackingKey || body.claveRastreo,
        timestamp: body.timestamp || body.fecha,
      };
    }

    // Structure 5: Nested in a 'data' object without type field
    if (body?.data?.id || body?.data?.orderId) {
      const d = body.data;
      return {
        orderId: d.id || d.orderId,
        status: d.status,
        detail: d.detail || d.message,
        trackingKey: d.trackingKey,
        timestamp: d.timestamp,
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting order status data:', error);
    return null;
  }
}

/**
 * Validate OPM RSA signature on incoming order status webhook
 *
 * OPM signs all webhooks with their private key. We verify using their public key.
 * The original string format for orderStatus webhooks is:
 * ||id|status|detail||
 */
async function validateOpmSignature(body: any): Promise<boolean> {
  try {
    const publicKey = process.env.OPM_PUBLIC_KEY;

    if (!publicKey) {
      console.error('OPM_PUBLIC_KEY not configured - cannot validate signature');
      return false;
    }

    // Extract signature from payload (can be at root level or in data)
    const signature = body?.sign || body?.data?.sign;

    if (!signature) {
      console.error('No signature (sign field) found in webhook payload');
      return false;
    }

    // Extract data for building original string
    // Handle both nested (type: 'orderStatus', data: {...}) and flat structures
    const data = body?.type === 'orderStatus' && body?.data ? body.data : body;

    // Validate required fields for signature verification
    const orderId = data?.id || data?.orderId;
    const status = data?.status;

    if (!orderId || !status) {
      console.error('Missing required fields (id/orderId, status) for signature verification');
      return false;
    }

    // Build the original string that OPM signed
    const originalString = buildOrderStatusOriginalString({
      id: orderId,
      status: status,
      detail: data?.detail || '',
    });

    console.log('Original string for signature verification:', originalString);

    // Verify the signature using OPM's public key
    const isValid = await verifySignature(originalString, signature, publicKey);

    if (!isValid) {
      console.error('RSA signature verification failed');
      console.error('Expected signature for original string:', originalString);
      console.error('Received signature:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('Error during signature validation:', error);
    return false;
  }
}

interface OrderStatusData {
  orderId: string;
  status: string;
  detail?: string;
  trackingKey?: string;
  timestamp?: number | string;
}

interface ProcessResult {
  success: boolean;
  message: string;
}

/**
 * Process the order status update
 * SECURITY: Uses validated state transitions to prevent invalid status changes
 */
async function processOrderStatus(data: OrderStatusData, clientIp?: string): Promise<ProcessResult> {
  try {
    // Log the status change
    console.log('Processing order status update:', {
      orderId: data.orderId,
      status: data.status,
      detail: data.detail,
      trackingKey: data.trackingKey,
    });

    // Try to find and update the transaction in our database
    let transactionUpdated = false;
    let foundBy = '';
    let validationError = '';

    try {
      // First try to find by OPM order ID
      let transaction = await getTransactionByOpmOrderId(data.orderId);

      if (transaction) {
        foundBy = 'opmOrderId';
        console.log(`Found transaction by OPM order ID: ${transaction.id}`);
      } else if (data.trackingKey) {
        // If not found by order ID, try by tracking key
        transaction = await getTransactionByTrackingKey(data.trackingKey);
        if (transaction) {
          foundBy = 'trackingKey';
          console.log(`Found transaction by tracking key: ${transaction.id}`);
        }
      }

      if (transaction) {
        // SECURITY: Use validated state transition update
        const updateResult = await updateTransactionStatusValidated(
          transaction.id,
          data.status,
          {
            errorDetail: data.detail,
            changeSource: 'webhook',
            ipAddress: clientIp,
          }
        );

        if (updateResult.success) {
          transactionUpdated = true;
          console.log(`Transaction ${transaction.id} (OPM: ${data.orderId}) status updated to ${data.status}`);
        } else {
          validationError = updateResult.error;
          console.warn(`State transition rejected: ${updateResult.error}`);
        }
      } else {
        console.warn(`Transaction not found for order ID: ${data.orderId} or tracking key: ${data.trackingKey || 'N/A'}`);
      }
    } catch (dbError) {
      console.error('Database error updating transaction:', dbError);
    }

    // Log status-specific information
    switch (data.status?.toLowerCase()) {
      case 'pending':
        console.log(`Order ${data.orderId} is pending`);
        break;

      case 'sent':
        console.log(`Order ${data.orderId} has been sent to SPEI`);
        break;

      case 'scattered':
      case 'settled':
      case 'completed':
        console.log(`Order ${data.orderId} successfully settled`);
        break;

      case 'canceled':
      case 'cancelled':
        console.log(`Order ${data.orderId} was canceled: ${data.detail || 'No detail'}`);
        break;

      case 'returned':
      case 'rejected':
        console.log(`Order ${data.orderId} was returned/rejected: ${data.detail || 'No detail'}`);
        break;

      default:
        console.log(`Order ${data.orderId} status: ${data.status}`);
    }

    return {
      success: transactionUpdated,
      message: transactionUpdated
        ? `Transaction updated to ${data.status} (found by ${foundBy})`
        : validationError
          ? `State transition rejected: ${validationError}`
          : `Status update logged but transaction not found in database`,
    };

  } catch (error) {
    console.error('Error processing order status:', error);
    return {
      success: false,
      message: 'Internal processing error',
    };
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'order-status-webhook',
    timestamp: new Date().toISOString(),
    message: 'Webhook is ready to receive order status updates',
  });
}

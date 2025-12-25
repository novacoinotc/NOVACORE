/**
 * Security Alerts System
 *
 * Sends real-time alerts for security events:
 * - Multiple failed login attempts
 * - Blocked webhook requests
 * - Suspicious activity patterns
 * - Kill switch activations
 * - Rate limit breaches
 *
 * Supports multiple alert channels:
 * - Email (AWS SES)
 * - Slack webhook
 * - Console (always on)
 * - CloudWatch (when configured)
 */

// Alert severity levels
export type AlertSeverity = 'info' | 'warning' | 'critical';

// Alert types
export type AlertType =
  | 'MULTIPLE_LOGIN_FAILURES'
  | 'ACCOUNT_LOCKED'
  | 'WEBHOOK_BLOCKED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'KILL_SWITCH_ACTIVATED'
  | 'INVALID_STATE_TRANSITION'
  | 'UNAUTHORIZED_ACCESS'
  | 'CSRF_VIOLATION'
  | 'BRUTE_FORCE_DETECTED';

export interface SecurityAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  requestId?: string;
  ipAddress?: string;
  userId?: string;
  userEmail?: string;
}

// In-memory tracking for alert deduplication
const recentAlerts = new Map<string, { count: number; firstSeen: Date; lastSeen: Date }>();
const ALERT_DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Thresholds for triggering alerts
const ALERT_THRESHOLDS = {
  loginFailures: 5,        // Alert after 5 failures from same IP
  webhookBlocks: 3,        // Alert after 3 blocked webhooks
  rateLimitBreaches: 10,   // Alert after 10 rate limit hits
  suspiciousPatterns: 3,   // Alert after 3 suspicious activities
};

/**
 * Send a security alert
 */
export async function sendSecurityAlert(alert: Omit<SecurityAlert, 'timestamp'>): Promise<void> {
  const fullAlert: SecurityAlert = {
    ...alert,
    timestamp: new Date(),
  };

  // Always log to console
  logAlertToConsole(fullAlert);

  // Check for deduplication
  const dedupKey = `${alert.type}:${alert.ipAddress || 'unknown'}`;
  const existing = recentAlerts.get(dedupKey);

  if (existing) {
    existing.count++;
    existing.lastSeen = new Date();

    // Only send external alerts periodically to avoid spam
    if (existing.count % 10 !== 0) {
      return;
    }
  } else {
    recentAlerts.set(dedupKey, {
      count: 1,
      firstSeen: new Date(),
      lastSeen: new Date(),
    });
  }

  // Send to external channels based on severity
  if (alert.severity === 'critical') {
    await Promise.all([
      sendSlackAlert(fullAlert),
      sendEmailAlert(fullAlert),
      logToCloudWatch(fullAlert),
    ]);
  } else if (alert.severity === 'warning') {
    await Promise.all([
      sendSlackAlert(fullAlert),
      logToCloudWatch(fullAlert),
    ]);
  } else {
    await logToCloudWatch(fullAlert);
  }
}

/**
 * Log alert to console with formatting
 */
function logAlertToConsole(alert: SecurityAlert): void {
  const severityPrefix = {
    info: '[INFO]',
    warning: '[WARNING]',
    critical: '[CRITICAL]',
  }[alert.severity];

  const emoji = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  }[alert.severity];

  console.log(`\n${emoji} [SECURITY-ALERT] ${severityPrefix} ${alert.type}`);
  console.log(`   Message: ${alert.message}`);
  console.log(`   Time: ${alert.timestamp.toISOString()}`);

  if (alert.ipAddress) {
    console.log(`   IP: ${alert.ipAddress}`);
  }

  if (alert.userId || alert.userEmail) {
    console.log(`   User: ${alert.userEmail || alert.userId}`);
  }

  if (alert.requestId) {
    console.log(`   Request ID: ${alert.requestId}`);
  }

  if (Object.keys(alert.details).length > 0) {
    console.log(`   Details:`, JSON.stringify(alert.details, null, 2));
  }

  console.log('');
}

/**
 * Send alert to Slack webhook
 */
async function sendSlackAlert(alert: SecurityAlert): Promise<void> {
  const webhookUrl = process.env.SLACK_SECURITY_WEBHOOK_URL;

  if (!webhookUrl) {
    return; // Slack not configured
  }

  const color = {
    info: '#36a64f',
    warning: '#ff9800',
    critical: '#dc3545',
  }[alert.severity];

  const payload = {
    attachments: [
      {
        color,
        title: `🔐 Security Alert: ${alert.type}`,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true,
          },
          {
            title: 'Time',
            value: alert.timestamp.toISOString(),
            short: true,
          },
          ...(alert.ipAddress
            ? [{ title: 'IP Address', value: alert.ipAddress, short: true }]
            : []),
          ...(alert.userEmail
            ? [{ title: 'User', value: alert.userEmail, short: true }]
            : []),
          ...(alert.requestId
            ? [{ title: 'Request ID', value: alert.requestId, short: true }]
            : []),
        ],
        footer: 'NOVACORE Security',
        ts: Math.floor(alert.timestamp.getTime() / 1000).toString(),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[SECURITY-ALERT] Failed to send Slack alert:', error);
  }
}

/**
 * Send alert via email (AWS SES)
 */
async function sendEmailAlert(alert: SecurityAlert): Promise<void> {
  const emailEnabled = process.env.SECURITY_ALERT_EMAIL;
  const sesRegion = process.env.AWS_SES_REGION || 'us-east-1';

  if (!emailEnabled) {
    return; // Email not configured
  }

  // For now, just log that we would send an email
  // Full SES integration would require aws-sdk
  console.log(`[SECURITY-ALERT] Would send email alert to: ${emailEnabled}`);

  // TODO: Implement AWS SES integration
  // const ses = new SESClient({ region: sesRegion });
  // await ses.send(new SendEmailCommand({...}));
}

/**
 * Log alert to CloudWatch
 */
async function logToCloudWatch(alert: SecurityAlert): Promise<void> {
  const cloudwatchEnabled = process.env.CLOUDWATCH_LOG_GROUP;

  if (!cloudwatchEnabled) {
    return; // CloudWatch not configured
  }

  // For now, log in a CloudWatch-compatible JSON format
  const cloudwatchLog = {
    timestamp: alert.timestamp.toISOString(),
    level: alert.severity.toUpperCase(),
    type: 'SECURITY_ALERT',
    alertType: alert.type,
    message: alert.message,
    requestId: alert.requestId,
    ipAddress: alert.ipAddress,
    userId: alert.userId,
    userEmail: alert.userEmail,
    details: alert.details,
  };

  // Log in JSON format for CloudWatch Logs Insights queries
  console.log(JSON.stringify(cloudwatchLog));

  // TODO: Implement direct CloudWatch Logs integration
  // const cloudwatch = new CloudWatchLogsClient({ region: process.env.AWS_REGION });
  // await cloudwatch.send(new PutLogEventsCommand({...}));
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Alert: Multiple failed login attempts
 */
export async function alertLoginFailures(
  ipAddress: string,
  attemptCount: number,
  userEmail?: string,
  requestId?: string
): Promise<void> {
  if (attemptCount < ALERT_THRESHOLDS.loginFailures) {
    return;
  }

  await sendSecurityAlert({
    type: 'MULTIPLE_LOGIN_FAILURES',
    severity: attemptCount >= 10 ? 'critical' : 'warning',
    message: `${attemptCount} failed login attempts detected from IP ${ipAddress}`,
    details: {
      attemptCount,
      targetUser: userEmail,
    },
    ipAddress,
    userEmail,
    requestId,
  });
}

/**
 * Alert: Account locked
 */
export async function alertAccountLocked(
  userEmail: string,
  ipAddress: string,
  requestId?: string
): Promise<void> {
  await sendSecurityAlert({
    type: 'ACCOUNT_LOCKED',
    severity: 'warning',
    message: `Account locked due to multiple failed login attempts: ${userEmail}`,
    details: {
      reason: 'Too many failed login attempts',
    },
    ipAddress,
    userEmail,
    requestId,
  });
}

/**
 * Alert: Webhook blocked
 */
export async function alertWebhookBlocked(
  ipAddress: string,
  reason: string,
  webhookType: string,
  requestId?: string
): Promise<void> {
  await sendSecurityAlert({
    type: 'WEBHOOK_BLOCKED',
    severity: 'critical',
    message: `Webhook request blocked from unauthorized IP: ${ipAddress}`,
    details: {
      reason,
      webhookType,
    },
    ipAddress,
    requestId,
  });
}

/**
 * Alert: Rate limit exceeded
 */
export async function alertRateLimitExceeded(
  ipAddress: string,
  endpoint: string,
  limit: number,
  requestId?: string
): Promise<void> {
  await sendSecurityAlert({
    type: 'RATE_LIMIT_EXCEEDED',
    severity: 'warning',
    message: `Rate limit exceeded for ${endpoint} from IP ${ipAddress}`,
    details: {
      endpoint,
      limit,
    },
    ipAddress,
    requestId,
  });
}

/**
 * Alert: Suspicious activity
 */
export async function alertSuspiciousActivity(
  description: string,
  details: Record<string, any>,
  ipAddress?: string,
  userId?: string,
  requestId?: string
): Promise<void> {
  await sendSecurityAlert({
    type: 'SUSPICIOUS_ACTIVITY',
    severity: 'critical',
    message: description,
    details,
    ipAddress,
    userId,
    requestId,
  });
}

/**
 * Alert: Kill switch activated
 */
export async function alertKillSwitchActivated(
  switchName: string,
  activatedBy?: string,
  requestId?: string
): Promise<void> {
  await sendSecurityAlert({
    type: 'KILL_SWITCH_ACTIVATED',
    severity: 'critical',
    message: `Kill switch activated: ${switchName}`,
    details: {
      switchName,
      activatedBy: activatedBy || 'environment',
    },
    requestId,
  });
}

/**
 * Alert: Brute force detected
 */
export async function alertBruteForceDetected(
  ipAddress: string,
  targetType: string,
  attemptCount: number,
  requestId?: string
): Promise<void> {
  await sendSecurityAlert({
    type: 'BRUTE_FORCE_DETECTED',
    severity: 'critical',
    message: `Possible brute force attack detected from ${ipAddress} targeting ${targetType}`,
    details: {
      targetType,
      attemptCount,
      timeWindow: '15 minutes',
    },
    ipAddress,
    requestId,
  });
}

// Cleanup old dedup entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of recentAlerts.entries()) {
      if (now - entry.lastSeen.getTime() > ALERT_DEDUP_WINDOW_MS) {
        recentAlerts.delete(key);
      }
    }
  }, 60 * 1000); // Every minute
}

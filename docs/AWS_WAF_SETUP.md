# AWS WAF Configuration Guide for NOVACORE

## Overview

This guide explains how to configure AWS WAF (Web Application Firewall) to protect NOVACORE from common web attacks.

## Quick Setup (AWS Console)

### 1. Create Web ACL

1. Go to AWS WAF Console → Web ACLs → Create web ACL
2. Settings:
   - Name: `novacore-waf`
   - Resource type: `Regional resources` (for ALB)
   - Region: Your region (e.g., `us-east-1`)

### 2. Add Managed Rule Groups (Recommended)

Add these AWS managed rules in order:

```
1. AWSManagedRulesCommonRuleSet
   - Protects against: OWASP Top 10, including SQLi, XSS
   - Action: Block

2. AWSManagedRulesKnownBadInputsRuleSet
   - Protects against: Known malicious inputs
   - Action: Block

3. AWSManagedRulesSQLiRuleSet
   - Protects against: SQL injection attacks
   - Action: Block

4. AWSManagedRulesAmazonIpReputationList
   - Protects against: Known malicious IPs
   - Action: Block
```

### 3. Add Rate-Based Rules

Create rate-based rules for DDoS protection:

#### Rule 1: Global Rate Limit
```json
{
  "Name": "GlobalRateLimit",
  "Priority": 1,
  "Statement": {
    "RateBasedStatement": {
      "Limit": 2000,
      "AggregateKeyType": "IP"
    }
  },
  "Action": { "Block": {} },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "GlobalRateLimit"
  }
}
```

#### Rule 2: Login Endpoint Rate Limit
```json
{
  "Name": "LoginRateLimit",
  "Priority": 2,
  "Statement": {
    "RateBasedStatement": {
      "Limit": 100,
      "AggregateKeyType": "IP",
      "ScopeDownStatement": {
        "ByteMatchStatement": {
          "SearchString": "/api/auth/login",
          "FieldToMatch": { "UriPath": {} },
          "PositionalConstraint": "STARTS_WITH",
          "TextTransformations": [{ "Priority": 0, "Type": "LOWERCASE" }]
        }
      }
    }
  },
  "Action": { "Block": {} }
}
```

#### Rule 3: API Rate Limit
```json
{
  "Name": "APIRateLimit",
  "Priority": 3,
  "Statement": {
    "RateBasedStatement": {
      "Limit": 1000,
      "AggregateKeyType": "IP",
      "ScopeDownStatement": {
        "ByteMatchStatement": {
          "SearchString": "/api/",
          "FieldToMatch": { "UriPath": {} },
          "PositionalConstraint": "STARTS_WITH",
          "TextTransformations": [{ "Priority": 0, "Type": "LOWERCASE" }]
        }
      }
    }
  },
  "Action": { "Block": {} }
}
```

### 4. Associate with ALB

1. Go to your Web ACL
2. Click "Associated AWS resources"
3. Click "Add AWS resources"
4. Select your Application Load Balancer
5. Click "Add"

## Terraform Configuration

```hcl
# waf.tf

resource "aws_wafv2_web_acl" "novacore" {
  name        = "novacore-waf"
  description = "WAF for NOVACORE banking application"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # SQL Injection Rule Set
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesSQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # IP Reputation
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesAmazonIpReputationListMetric"
      sampled_requests_enabled   = true
    }
  }

  # Global Rate Limit
  rule {
    name     = "GlobalRateLimit"
    priority = 5

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GlobalRateLimitMetric"
      sampled_requests_enabled   = true
    }
  }

  # Login Rate Limit
  rule {
    name     = "LoginRateLimit"
    priority = 6

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 100
        aggregate_key_type = "IP"

        scope_down_statement {
          byte_match_statement {
            search_string = "/api/auth/login"
            field_to_match {
              uri_path {}
            }
            positional_constraint = "STARTS_WITH"
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "LoginRateLimitMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "novacoreWAFMetric"
    sampled_requests_enabled   = true
  }

  tags = {
    Environment = "production"
    Application = "novacore"
  }
}

# Associate with ALB
resource "aws_wafv2_web_acl_association" "novacore" {
  resource_arn = aws_lb.novacore.arn
  web_acl_arn  = aws_wafv2_web_acl.novacore.arn
}
```

## CloudWatch Alarms

Set up alarms for WAF events:

```hcl
resource "aws_cloudwatch_metric_alarm" "waf_blocked_requests" {
  alarm_name          = "novacore-waf-blocked-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "High number of blocked requests"

  dimensions = {
    WebACL = aws_wafv2_web_acl.novacore.name
    Region = var.aws_region
    Rule   = "ALL"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
```

## Testing WAF Rules

After setup, test your WAF rules:

```bash
# Test SQL Injection blocking
curl -X POST "https://your-domain.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com OR 1=1--", "password": "test"}'
# Should be blocked (403)

# Test XSS blocking
curl "https://your-domain.com/api/users?name=<script>alert(1)</script>"
# Should be blocked (403)

# Test rate limiting
for i in {1..150}; do
  curl -s "https://your-domain.com/api/auth/login" &
done
# After limit, should start getting blocked
```

## Monitoring

View WAF metrics in CloudWatch:
- `AllowedRequests` - Requests that passed WAF
- `BlockedRequests` - Requests blocked by WAF
- `CountedRequests` - Requests counted (for rate limiting)

## Cost Estimate

| Component | Monthly Cost (approx) |
|-----------|----------------------|
| Web ACL | $5.00 |
| Rules (6 rules) | $6.00 |
| Requests (1M) | $0.60 |
| **Total** | **~$12-15/month** |

## Support

For issues with WAF configuration, check:
1. CloudWatch Logs for blocked requests
2. WAF sample requests for false positives
3. Adjust rules if legitimate traffic is blocked

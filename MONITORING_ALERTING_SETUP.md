# Monitoring and Alerting Setup Guide

## Overview

This document provides comprehensive guidance for setting up production-grade monitoring and alerting for the Threat Modeling Platform using Prometheus, Grafana, and Alertmanager.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Services      │────│   Prometheus    │────│   Grafana       │
│   (Metrics)     │    │   (Collection)  │    │   (Dashboards)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Alertmanager   │────│  Notifications  │
                       │   (Alerting)    │    │   (Email/Slack) │
                       └─────────────────┘    └─────────────────┘
```

## Components

### 1. Prometheus (Metrics Collection)
- **Port**: 9090
- **Purpose**: Scrapes metrics from all services
- **URL**: http://localhost:9090

### 2. Grafana (Dashboards)
- **Port**: 3007
- **Purpose**: Visualizes metrics in dashboards
- **URL**: http://localhost:3007
- **Default Credentials**: admin/admin123

### 3. Alertmanager (Alert Management)
- **Port**: 9093
- **Purpose**: Manages and routes alerts
- **URL**: http://localhost:9093

## Service Metrics Endpoints

### Working Metrics Endpoints ✅
| Service | Port | Endpoint | Status |
|---------|------|----------|--------|
| Core Service | 3002 | `/metrics` | ✅ Working |
| Notification Service | 3009 | `/metrics` | ✅ Working |
| Prometheus | 9090 | `/metrics` | ✅ Working |

### Health Check Endpoints ✅
| Service | Port | Endpoint | Format |
|---------|------|----------|--------|
| Auth Service | 3001 | `/health` | JSON |
| AI Service | 3003 | `/health` | JSON |
| Diagram Service | 3004 | `/health` | JSON |
| Report Service | 3005 | `/health` | JSON |
| API Gateway | 3000 | `/health` | JSON |

## Prometheus Configuration

### Target Jobs
```yaml
scrape_configs:
  # Core application services with metrics
  - job_name: 'threatmodel-core'
    static_configs:
      - targets: ['core-service:3002']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'threatmodel-notification'
    static_configs:
      - targets: ['notification-service:3009']
    metrics_path: /metrics
    scrape_interval: 30s

  # Health endpoints for service monitoring
  - job_name: 'threatmodel-health'
    static_configs:
      - targets: ['auth-service:3001', 'ai-service:3003', 'diagram-service:3004']
    metrics_path: /health
    scrape_interval: 60s
```

### Available Metrics

#### Core Service Metrics
```prometheus
# HTTP request metrics
http_requests_total{service="core-service"} 156
http_request_duration_ms{service="core-service"} 1

# Service status
core_service_up{service="core-service"} 1

# Database connections
active_connections{service="core-service"} 0

# Business metrics
vulnerabilities_total{service="core-service"} 0
threats_total{service="core-service"} 0
projects_total{service="core-service"} 0
```

#### Notification Service Metrics
```prometheus
# Service uptime
notification_service_uptime_seconds 1474

# Memory usage
notification_service_memory_usage_bytes{type="rss"} 106127360
notification_service_memory_usage_bytes{type="heapTotal"} 45039616
notification_service_memory_usage_bytes{type="heapUsed"} 43343856

# Service info
notification_service_info{version="0.1.0",node_version="v18.x"} 1
```

## Grafana Dashboard

### Dashboard Features
- **HTTP Requests per Second**: Real-time request rates across services
- **Service Health Status**: Visual status indicators for all services
- **Response Time Monitoring**: Latency tracking with warning thresholds
- **Memory Usage**: Resource consumption monitoring
- **Business Metrics**: Vulnerabilities, threats, and project counts

### Key Panels
1. **Service Status Table**: Real-time health status of all services
2. **Request Rate Graph**: HTTP requests per second with service breakdown
3. **Response Time Chart**: Latency monitoring with 1s/2s thresholds
4. **Memory Usage**: Heap and RSS memory consumption
5. **Business Metrics**: Security-specific counters

### Dashboard JSON Location
```
/opt/projects/threat-modeling-platform/infrastructure/grafana/dashboards/threat-modeling-platform.json
```

## Alert Rules

### Service Health Alerts
```yaml
# Critical service down alerts
- alert: ServiceDown
  expr: core_service_up == 0
  for: 1m
  labels:
    severity: critical
    service: core-service
  annotations:
    summary: "Core service is down"
    description: "Core service has been down for more than 1 minute."
```

### Performance Alerts
```yaml
# Response time alerts
- alert: HighResponseTime
  expr: http_request_duration_ms > 2000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High response time detected"
    description: "Response time above 2000ms for more than 5 minutes."

- alert: CriticalResponseTime
  expr: http_request_duration_ms > 5000
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Critical response time detected"
    description: "Response time above 5000ms for more than 2 minutes."
```

### Security Alerts
```yaml
# Vulnerability count alerts
- alert: HighVulnerabilityCount
  expr: vulnerabilities_total > 50
  for: 0m
  labels:
    severity: warning
    service: security
  annotations:
    summary: "High number of vulnerabilities detected"
    description: "Total vulnerability count has exceeded 50."
```

### Resource Usage Alerts
```yaml
# Memory usage alerts
- alert: HighMemoryUsage
  expr: notification_service_memory_usage_bytes{type="heapUsed"} > 500000000
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage detected"
    description: "Memory usage above 500MB for more than 10 minutes."
```

## Alertmanager Configuration

### Alert Routing
```yaml
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
  - match:
      severity: critical
    receiver: critical-alerts
  - match:
      severity: warning
    receiver: warning-alerts
```

### Notification Channels

#### Critical Alerts
- **Email**: security-team@company.com
- **Slack**: #security-alerts channel
- **Webhook**: Notification service integration

#### Warning Alerts
- **Email**: devops-team@company.com

#### Webhook Integration
```yaml
webhook_configs:
- url: 'http://notification-service:3009/api/notifications/events'
  send_resolved: true
  http_config:
    bearer_token: 'your-webhook-token'
```

## Deployment

### 1. Start Monitoring Stack
```bash
# Start all monitoring components
docker-compose up -d prometheus grafana alertmanager

# Check service status
docker ps | grep -E "(prometheus|grafana|alertmanager)"
```

### 2. Verify Prometheus Targets
```bash
# Check target health
curl -s "http://localhost:9090/api/v1/targets" | \
  jq -r '.data.activeTargets[] | select(.health == "up") | .labels.job'
```

### 3. Access Grafana Dashboard
1. Open http://localhost:3007
2. Login with admin/admin123
3. Import dashboard from `infrastructure/grafana/dashboards/`

### 4. Verify Alerting
```bash
# Check alert rules loaded
curl -s "http://localhost:9090/api/v1/rules" | jq '.data.groups[].name'

# Check Alertmanager status
curl -s http://localhost:9093/-/healthy
```

## Troubleshooting

### Common Issues

#### Prometheus Can't Scrape Metrics
**Problem**: 404 errors on `/metrics` endpoints
**Solution**: 
- Verify service implements metrics endpoint
- Check Prometheus configuration targets
- Ensure services are running and accessible

#### Grafana Dashboard Empty
**Problem**: No data showing in Grafana panels
**Solution**:
- Verify Prometheus data source configuration
- Check Prometheus targets are healthy
- Confirm metric names match dashboard queries

#### Alerts Not Firing
**Problem**: Expected alerts not triggering
**Solution**:
- Check alert rule syntax in Prometheus UI
- Verify metric data exists in Prometheus
- Check Alertmanager configuration

#### High Memory Usage in Services
**Problem**: Services consuming excessive memory
**Solution**:
- Monitor memory metrics in Grafana
- Set up memory usage alerts
- Implement memory optimization

### Verification Commands
```bash
# Check Prometheus targets
curl -s "http://localhost:9090/api/v1/targets" | jq '.data.activeTargets[].health'

# Test metrics endpoints
curl -s http://localhost:3002/metrics | head -10
curl -s http://localhost:3009/metrics | head -10

# Check alert rules
curl -s "http://localhost:9090/api/v1/rules" | jq '.data.groups[].rules[].name'

# Verify Alertmanager
curl -s http://localhost:9093/api/v1/status
```

## Security Considerations

### Access Control
- Restrict Prometheus/Grafana access to authorized users
- Use strong passwords for Grafana admin account
- Consider implementing OAuth/LDAP authentication

### Network Security
- Run monitoring stack in isolated network
- Use TLS for external communications
- Implement firewall rules for monitoring ports

### Data Retention
- Configure appropriate data retention policies
- Regular backup of Grafana dashboards and Prometheus data
- Monitor disk usage for time-series data

## Maintenance

### Regular Tasks
1. **Weekly**: Review alert fatigue and tune thresholds
2. **Monthly**: Update Grafana dashboards based on new metrics
3. **Quarterly**: Review and update alert rules
4. **Annually**: Audit access controls and security settings

### Capacity Planning
- Monitor Prometheus storage usage
- Plan for metric cardinality growth
- Scale Grafana for user load

## Production Recommendations

### High Availability
- Deploy Prometheus in HA mode with multiple replicas
- Use Grafana clustering for redundancy
- Implement Alertmanager clustering

### Performance Optimization
- Tune Prometheus retention and scrape intervals
- Optimize Grafana query performance
- Use recording rules for complex queries

### Integration
- Connect with existing ticketing systems
- Integrate with CI/CD pipelines for deployment alerts
- Set up custom webhooks for business-specific notifications

## Metrics Catalog

### Service Health Metrics
- `core_service_up`: Core service availability (0/1)
- `notification_service_info`: Notification service status
- `http_requests_total`: Total HTTP requests by service
- `http_request_duration_ms`: Request latency by service

### Business Metrics
- `vulnerabilities_total`: Total vulnerabilities in system
- `threats_total`: Total threats identified
- `projects_total`: Total projects in platform
- `reports_generated_total`: Total reports generated

### Infrastructure Metrics
- `active_connections`: Database connection count
- `notification_service_memory_usage_bytes`: Memory usage by type
- `notification_service_uptime_seconds`: Service uptime

This monitoring and alerting setup provides comprehensive visibility into the Threat Modeling Platform's health, performance, and security posture.
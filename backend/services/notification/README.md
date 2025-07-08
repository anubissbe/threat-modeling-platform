# Notification Service

The notification service handles all notifications across the threat modeling platform, including email, Slack, Microsoft Teams, SMS, and webhook notifications.

## Features

- **Multi-channel notifications**: Email, Slack, Microsoft Teams, SMS, webhooks
- **Template management**: Create and manage notification templates
- **User preferences**: Customizable notification preferences per user
- **Event-driven**: React to events from other services via Redis pub/sub
- **Scheduled notifications**: Support for delayed and recurring notifications
- **Rate limiting**: Prevent spam and API abuse
- **Audit logging**: Track all notification activities

## API Endpoints

### Core Notifications
- `POST /api/notifications/send` - Send immediate notification
- `POST /api/notifications/schedule` - Schedule future notification
- `GET /api/notifications` - List notification history
- `DELETE /api/notifications/:id` - Cancel scheduled notification

### Templates
- `POST /api/notifications/templates` - Create/update template
- `GET /api/notifications/templates` - List templates
- `GET /api/notifications/templates/:id` - Get template
- `DELETE /api/notifications/templates/:id` - Delete template

### Preferences
- `POST /api/notifications/preferences` - Set user preferences
- `GET /api/notifications/preferences/:userId` - Get user preferences
- `PUT /api/notifications/preferences/:userId` - Update user preferences

### Subscriptions
- `POST /api/notifications/subscriptions` - Subscribe to events
- `GET /api/notifications/subscriptions/:userId` - Get user subscriptions
- `DELETE /api/notifications/subscriptions/:id` - Unsubscribe

## Configuration

Environment variables:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` - Email settings
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` - Slack integration
- `TEAMS_WEBHOOK_URL` - Microsoft Teams webhook
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - SMS via Twilio
- `REDIS_URL` - Redis connection for pub/sub and queuing
- `DATABASE_URL` - PostgreSQL connection

## Event Types

The service listens for these events:
- `threat-model.created` - New threat model created
- `threat-model.updated` - Threat model modified
- `threat-model.deleted` - Threat model deleted
- `threat.identified` - New threat identified
- `threat.mitigated` - Threat mitigated
- `collaboration.invited` - User invited to collaborate
- `collaboration.mentioned` - User mentioned in comments
- `report.generated` - Report generation completed
- `system.maintenance` - System maintenance alerts

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Docker

```bash
# Build image
docker build -t threat-modeling/notification-service .

# Run container
docker run -p 3009:3009 threat-modeling/notification-service
```
# Threat Modeling Platform - Login Credentials

## Admin Account

- **Email:** admin@threatmodel.com
- **Password:** Admin123!

## Important Notes

- The password includes a special character (!) at the end
- Password requirements:
  - At least 8 characters
  - Contains uppercase letter
  - Contains lowercase letter
  - Contains number
  - Contains special character

## Access URL

- **Platform URL:** http://localhost:3006/
- **API Gateway:** http://localhost:3000/

## Authentication Issues Fixed

1. Token refresh API now properly accepts JSON format
2. Admin password updated with correct bcrypt hash (12 rounds)
3. Password meets all security requirements
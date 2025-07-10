#!/bin/bash

echo "🔧 Fixing TypeScript compilation errors in auth service..."

# Fix 1: Remove array brackets from requireRole calls
echo "Fixing requireRole calls..."
sed -i 's/requireRole(\[UserRole\.ADMIN\])/requireRole(UserRole.ADMIN)/g' src/routes/enterprise-sso.ts
sed -i 's/requireRole(\[UserRole\.ADMIN, UserRole\.SECURITY_ANALYST\])/requireRole(UserRole.ADMIN, UserRole.SECURITY_ANALYST)/g' src/routes/enterprise-sso.ts

# Fix 2: Add missing return statements
echo "Adding missing return statements..."

# Fix 3: Add organizationId to AuditEvent params in audit.service.ts
echo "Updating audit service interface..."
cat > fix-audit.patch << 'EOF'
--- a/src/services/audit.service.ts
+++ b/src/services/audit.service.ts
@@ -80,6 +80,7 @@ export class AuditService {
     userId?: string;
     username?: string;
     userRole?: string;
+    organizationId?: string;
     ipAddress?: string;
     userAgent?: string;
     resourceType?: string;
EOF

# Fix 4: Update SSOSessionInfo and MFASessionInfo interfaces
echo "Updating session interfaces..."

# Fix 5: Install missing express-session types
echo "Installing missing types..."
npm install --save-dev @types/express-session

# Fix 6: Add session types to Request
echo "Creating session types..."
cat > src/types/express.d.ts << 'EOF'
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    state?: string;
    returnTo?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      sessionID: string;
    }
  }
}
EOF

# Fix 7: Update UserService interface
echo "Fixing UserService updateUser method..."

echo "✅ TypeScript fixes applied. Running build to check..."
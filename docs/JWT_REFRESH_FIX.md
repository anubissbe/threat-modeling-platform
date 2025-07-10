# JWT Refresh Token Fix Documentation

## Issue Summary
The JWT refresh token functionality was failing with a "duplicate key value violates unique constraint" error in the PostgreSQL database. This occurred because refresh tokens were deterministic - the same userId + timestamp would generate the same token.

## Root Cause
The `generateRefreshToken` function in `/backend/services/auth/src/utils/jwt.ts` was creating tokens with only the userId and standard JWT fields (iat, exp). When multiple refresh attempts happened within the same second, identical tokens were generated, causing database constraint violations.

## Solution
Added a unique identifier (jti - JWT ID) to each refresh token using `crypto.randomBytes(16).toString('hex')`. This ensures every token is unique even if generated for the same user at the same timestamp.

### Code Changes

**File**: `/backend/services/auth/src/utils/jwt.ts`

```typescript
import crypto from 'crypto';

export function generateRefreshToken(userId: string): string {
  // Add a unique JWT ID (jti) to prevent duplicate token issues
  const jti = crypto.randomBytes(16).toString('hex');
  
  return jwt.sign({ userId, jti }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  } as any);
}

export function verifyRefreshToken(token: string): { userId: string; jti?: string } | null {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as { userId: string; jti?: string };
  } catch (error) {
    logger.warn('Invalid refresh token:', error);
    return null;
  }
}
```

## Testing Results

### Test Script
Created `test-fresh-jwt-refresh.js` to verify:
1. User registration
2. Initial authentication
3. Token refresh functionality
4. New token validation
5. Old token invalidation

### Results
- ✅ All tests pass consistently
- ✅ No duplicate token errors
- ✅ Tokens are properly invalidated after refresh
- ✅ Multiple concurrent users can refresh without conflicts

### Database Verification
```sql
SELECT COUNT(*), COUNT(DISTINCT token) as unique_tokens 
FROM refresh_tokens 
WHERE created_at > NOW() - INTERVAL '5 minutes';
```
Result: All tokens are unique (count = unique_tokens)

## Deployment Notes

### Temporary Workaround
Due to unrelated TypeScript compilation errors in the SSO/MFA modules, the fix was deployed by:
1. Compiling jwt.ts separately: `npx tsc src/utils/jwt.ts --outDir temp_dist`
2. Copying to container: `docker cp temp_dist/utils/jwt.js threatmodel-auth:/app/dist/utils/jwt.js`
3. Restarting service: `docker restart threatmodel-auth`

### Permanent Fix Required
The TypeScript compilation errors in the auth service need to be resolved to allow normal builds. These errors are in:
- SSO service type definitions
- MFA service implementations
- Integration service types

## Security Considerations
- The jti field adds entropy to tokens without exposing sensitive information
- Old tokens are properly invalidated in the database
- No changes to token expiration or validation logic

## Performance Impact
- Minimal: crypto.randomBytes is fast and adds negligible overhead
- No database schema changes required
- No impact on token verification performance

## Date Fixed
January 10, 2025
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3006';
const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:3001';

describe('Authentication E2E Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
      slowMo: process.env.CI === 'true' ? 0 : 100,
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
    
    // Clear any existing storage
    await context.clearCookies();
    await page.goto(BASE_URL);
  });

  afterEach(async () => {
    await context.close();
  });

  describe('User Registration Flow', () => {
    it('should register a new user successfully', async () => {
      await page.goto(`${BASE_URL}/register`);
      
      // Fill registration form
      await page.fill('[data-testid="email-input"]', 'e2etest@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="first-name-input"]', 'E2E');
      await page.fill('[data-testid="last-name-input"]', 'Test');
      await page.fill('[data-testid="organization-input"]', 'Test Organization');
      
      // Submit form
      await page.click('[data-testid="register-button"]');
      
      // Wait for redirect to dashboard
      await page.waitForURL(`${BASE_URL}/dashboard`);
      
      // Verify user is logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('text=E2E Test')).toBeVisible();
    });

    it('should show validation errors for invalid inputs', async () => {
      await page.goto(`${BASE_URL}/register`);
      
      // Try to submit with invalid email
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.fill('[data-testid="password-input"]', 'weak');
      await page.click('[data-testid="register-button"]');
      
      // Check for validation errors
      await expect(page.locator('text=Please enter a valid email')).toBeVisible();
      await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
    });

    it('should prevent duplicate email registration', async () => {
      // First, register a user
      await page.goto(`${BASE_URL}/register`);
      await page.fill('[data-testid="email-input"]', 'duplicate@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="first-name-input"]', 'First');
      await page.fill('[data-testid="last-name-input"]', 'User');
      await page.fill('[data-testid="organization-input"]', 'Test Org');
      await page.click('[data-testid="register-button"]');
      
      await page.waitForURL(`${BASE_URL}/dashboard`);
      
      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      
      // Try to register with same email
      await page.goto(`${BASE_URL}/register`);
      await page.fill('[data-testid="email-input"]', 'duplicate@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="first-name-input"]', 'Second');
      await page.fill('[data-testid="last-name-input"]', 'User');
      await page.fill('[data-testid="organization-input"]', 'Test Org');
      await page.click('[data-testid="register-button"]');
      
      // Should show error
      await expect(page.locator('text=Email already exists')).toBeVisible();
    });
  });

  describe('User Login Flow', () => {
    beforeEach(async () => {
      // Register a test user first
      await page.goto(`${BASE_URL}/register`);
      await page.fill('[data-testid="email-input"]', 'logintest@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="first-name-input"]', 'Login');
      await page.fill('[data-testid="last-name-input"]', 'Test');
      await page.fill('[data-testid="organization-input"]', 'Test Org');
      await page.click('[data-testid="register-button"]');
      
      await page.waitForURL(`${BASE_URL}/dashboard`);
      
      // Logout to test login
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
    });

    it('should login with valid credentials', async () => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('[data-testid="email-input"]', 'logintest@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.click('[data-testid="login-button"]');
      
      await page.waitForURL(`${BASE_URL}/dashboard`);
      
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('text=Login Test')).toBeVisible();
    });

    it('should show error for invalid credentials', async () => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('[data-testid="email-input"]', 'logintest@example.com');
      await page.fill('[data-testid="password-input"]', 'WrongPassword');
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('text=Invalid credentials')).toBeVisible();
      // Should not redirect
      expect(page.url()).toBe(`${BASE_URL}/login`);
    });

    it('should redirect to login when accessing protected routes', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Should redirect to login
      await page.waitForURL(`${BASE_URL}/login`);
    });

    it('should remember user after page refresh', async () => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.fill('[data-testid="email-input"]', 'logintest@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.click('[data-testid="login-button"]');
      
      await page.waitForURL(`${BASE_URL}/dashboard`);
      
      // Refresh page
      await page.reload();
      
      // Should still be logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });
  });

  describe('Password Management', () => {
    beforeEach(async () => {
      // Register and login
      await page.goto(`${BASE_URL}/register`);
      await page.fill('[data-testid="email-input"]', 'passwordtest@example.com');
      await page.fill('[data-testid="password-input"]', 'OldPassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'OldPassword123!');
      await page.fill('[data-testid="first-name-input"]', 'Password');
      await page.fill('[data-testid="last-name-input"]', 'Test');
      await page.fill('[data-testid="organization-input"]', 'Test Org');
      await page.click('[data-testid="register-button"]');
      
      await page.waitForURL(`${BASE_URL}/dashboard`);
    });

    it('should change password successfully', async () => {
      // Navigate to settings
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="settings-link"]');
      
      // Change password
      await page.fill('[data-testid="current-password-input"]', 'OldPassword123!');
      await page.fill('[data-testid="new-password-input"]', 'NewPassword123!');
      await page.fill('[data-testid="confirm-new-password-input"]', 'NewPassword123!');
      await page.click('[data-testid="change-password-button"]');
      
      // Should show success message
      await expect(page.locator('text=Password changed successfully')).toBeVisible();
      
      // Logout and try logging in with new password
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      
      await page.goto(`${BASE_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'passwordtest@example.com');
      await page.fill('[data-testid="password-input"]', 'NewPassword123!');
      await page.click('[data-testid="login-button"]');
      
      await page.waitForURL(`${BASE_URL}/dashboard`);
    });

    it('should show error for incorrect current password', async () => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="settings-link"]');
      
      await page.fill('[data-testid="current-password-input"]', 'WrongPassword');
      await page.fill('[data-testid="new-password-input"]', 'NewPassword123!');
      await page.fill('[data-testid="confirm-new-password-input"]', 'NewPassword123!');
      await page.click('[data-testid="change-password-button"]');
      
      await expect(page.locator('text=Current password is incorrect')).toBeVisible();
    });
  });

  describe('Session Management', () => {
    it('should handle session timeout', async () => {
      // Register and login
      await page.goto(`${BASE_URL}/register`);
      await page.fill('[data-testid="email-input"]', 'sessiontest@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="first-name-input"]', 'Session');
      await page.fill('[data-testid="last-name-input"]', 'Test');
      await page.fill('[data-testid="organization-input"]', 'Test Org');
      await page.click('[data-testid="register-button"]');
      
      await page.waitForURL(`${BASE_URL}/dashboard`);
      
      // Manually expire the token by clearing localStorage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      
      // Try to navigate to a protected route
      await page.goto(`${BASE_URL}/projects`);
      
      // Should redirect to login
      await page.waitForURL(`${BASE_URL}/login`);
    });

    it('should logout from all sessions', async () => {
      // Register and login
      await page.goto(`${BASE_URL}/register`);
      await page.fill('[data-testid="email-input"]', 'multitest@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="first-name-input"]', 'Multi');
      await page.fill('[data-testid="last-name-input"]', 'Test');
      await page.fill('[data-testid="organization-input"]', 'Test Org');
      await page.click('[data-testid="register-button"]');
      
      await page.waitForURL(`${BASE_URL}/dashboard`);
      
      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      
      await page.waitForURL(`${BASE_URL}/login`);
      
      // Verify we're logged out
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });
  });

  describe('Security Features', () => {
    it('should prevent XSS attacks in input fields', async () => {
      await page.goto(`${BASE_URL}/register`);
      
      const xssPayload = '<script>alert("XSS")</script>';
      
      await page.fill('[data-testid="first-name-input"]', xssPayload);
      await page.fill('[data-testid="email-input"]', 'xsstest@example.com');
      await page.fill('[data-testid="password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');
      await page.fill('[data-testid="last-name-input"]', 'Test');
      await page.fill('[data-testid="organization-input"]', 'Test Org');
      
      await page.click('[data-testid="register-button"]');
      
      // Should not execute script - no alert should appear
      const dialogs: string[] = [];
      page.on('dialog', (dialog) => {
        dialogs.push(dialog.message());
        dialog.dismiss();
      });
      
      await page.waitForTimeout(1000);
      expect(dialogs).toHaveLength(0);
    });

    it('should handle rate limiting gracefully', async () => {
      await page.goto(`${BASE_URL}/login`);
      
      // Make multiple failed login attempts rapidly
      for (let i = 0; i < 6; i++) {
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'wrongpassword');
        await page.click('[data-testid="login-button"]');
        await page.waitForTimeout(100);
      }
      
      // Should show rate limiting message
      await expect(page.locator('text=Too many requests')).toBeVisible();
    });
  });

  describe('Accessibility', () => {
    it('should be navigable with keyboard', async () => {
      await page.goto(`${BASE_URL}/login`);
      
      // Tab through form fields
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="email-input"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="password-input"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
    });

    it('should have proper ARIA labels', async () => {
      await page.goto(`${BASE_URL}/login`);
      
      const emailInput = page.locator('[data-testid="email-input"]');
      const passwordInput = page.locator('[data-testid="password-input"]');
      
      await expect(emailInput).toHaveAttribute('aria-label', 'Email address');
      await expect(passwordInput).toHaveAttribute('aria-label', 'Password');
    });

    it('should announce form validation errors to screen readers', async () => {
      await page.goto(`${BASE_URL}/login`);
      
      await page.click('[data-testid="login-button"]');
      
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });
  });
});
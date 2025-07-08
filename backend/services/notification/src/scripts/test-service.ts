#!/usr/bin/env ts-node

import axios from 'axios';
import { logger } from '../utils/logger';

const API_BASE_URL = process.env['API_BASE_URL'] || 'http://localhost:3009';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration: number;
}

class NotificationServiceTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    logger.info('Starting notification service tests...');

    await this.testHealthCheck();
    await this.testSendNotification();
    await this.testTemplateOperations();
    await this.testPreferences();

    this.printResults();
  }

  private async testHealthCheck(): Promise<void> {
    const testName = 'Health Check';
    const startTime = Date.now();

    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      
      if (response.status === 200 && response.data.success) {
        this.results.push({
          name: testName,
          success: true,
          message: 'Health check passed',
          duration: Date.now() - startTime,
        });
      } else {
        this.results.push({
          name: testName,
          success: false,
          message: `Health check failed: ${response.data.message}`,
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        message: `Health check error: ${(error as Error).message}`,
        duration: Date.now() - startTime,
      });
    }
  }

  private async testSendNotification(): Promise<void> {
    const testName = 'Send Notification';
    const startTime = Date.now();

    try {
      const testNotification = {
        userId: 'test-user-id',
        type: 'email',
        channel: 'test@example.com',
        subject: 'Test Notification',
        message: 'This is a test notification from the notification service test suite.',
        priority: 'medium',
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/notifications/send`,
        testNotification,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token', // Mock token for testing
          },
        }
      );

      if (response.status === 201 && response.data.success) {
        this.results.push({
          name: testName,
          success: true,
          message: 'Notification sent successfully',
          duration: Date.now() - startTime,
        });
      } else {
        this.results.push({
          name: testName,
          success: false,
          message: `Send notification failed: ${response.data.message}`,
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      const axiosError = error as any;
      let errorMessage = 'Unknown error';
      
      if (axiosError.response) {
        errorMessage = `HTTP ${axiosError.response.status}: ${axiosError.response.data?.message || axiosError.message}`;
      } else {
        errorMessage = axiosError.message;
      }

      this.results.push({
        name: testName,
        success: false,
        message: `Send notification error: ${errorMessage}`,
        duration: Date.now() - startTime,
      });
    }
  }

  private async testTemplateOperations(): Promise<void> {
    const testName = 'Template Operations';
    const startTime = Date.now();

    try {
      // Test getting templates
      const templatesResponse = await axios.get(
        `${API_BASE_URL}/api/notifications/templates`,
        {
          headers: {
            'Authorization': 'Bearer test-token',
          },
        }
      );

      if (templatesResponse.status === 200 && templatesResponse.data.success) {
        this.results.push({
          name: testName,
          success: true,
          message: 'Template operations working',
          duration: Date.now() - startTime,
        });
      } else {
        this.results.push({
          name: testName,
          success: false,
          message: `Template operations failed: ${templatesResponse.data.message}`,
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      const axiosError = error as any;
      let errorMessage = 'Unknown error';
      
      if (axiosError.response) {
        errorMessage = `HTTP ${axiosError.response.status}: ${axiosError.response.data?.message || axiosError.message}`;
      } else {
        errorMessage = axiosError.message;
      }

      this.results.push({
        name: testName,
        success: false,
        message: `Template operations error: ${errorMessage}`,
        duration: Date.now() - startTime,
      });
    }
  }

  private async testPreferences(): Promise<void> {
    const testName = 'User Preferences';
    const startTime = Date.now();

    try {
      // Test getting default preferences
      const preferencesResponse = await axios.get(
        `${API_BASE_URL}/api/notifications/preferences/defaults`,
        {
          headers: {
            'Authorization': 'Bearer test-token',
          },
        }
      );

      if (preferencesResponse.status === 200 && preferencesResponse.data.success) {
        this.results.push({
          name: testName,
          success: true,
          message: 'Preferences operations working',
          duration: Date.now() - startTime,
        });
      } else {
        this.results.push({
          name: testName,
          success: false,
          message: `Preferences operations failed: ${preferencesResponse.data.message}`,
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      const axiosError = error as any;
      let errorMessage = 'Unknown error';
      
      if (axiosError.response) {
        errorMessage = `HTTP ${axiosError.response.status}: ${axiosError.response.data?.message || axiosError.message}`;
      } else {
        errorMessage = axiosError.message;
      }

      this.results.push({
        name: testName,
        success: false,
        message: `Preferences operations error: ${errorMessage}`,
        duration: Date.now() - startTime,
      });
    }
  }

  private printResults(): void {
    logger.info('\n=== Notification Service Test Results ===');
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    this.results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      logger.info(`${status} ${result.name} (${result.duration}ms): ${result.message}`);
    });

    logger.info(`\nSummary: ${passedTests}/${totalTests} tests passed`);
    
    if (failedTests > 0) {
      logger.warn(`${failedTests} test(s) failed`);
      process.exit(1);
    } else {
      logger.info('All tests passed!');
      process.exit(0);
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new NotificationServiceTester();
  tester.runAllTests().catch((error) => {
    logger.error('Test suite failed:', error);
    process.exit(1);
  });
}

export default NotificationServiceTester;
#!/usr/bin/env node

/**
 * Comprehensive Test Coverage Report Generator
 * 
 * This script runs tests across all services and generates a unified coverage report
 * to help achieve the goal of 80%+ test coverage.
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Comprehensive Test Coverage Report');
console.log('=====================================\n');

const services = [
  'auth',
  'core', 
  'ai',
  'tmac',
  'diagram',
  'notification',
  'integration',
  'reporting'
];

const testResults = [];

async function runServiceTests(serviceName) {
  console.log(`📋 Testing ${serviceName} service...`);
  
  const servicePath = path.join('backend/services', serviceName);
  
  // Check if service exists
  if (!fs.existsSync(servicePath)) {
    console.log(`⚠️  Service ${serviceName} not found at ${servicePath}`);
    return {
      service: serviceName,
      status: 'not_found',
      coverage: 0,
      tests: { passed: 0, failed: 0, total: 0 }
    };
  }

  // Check if package.json exists
  const packageJsonPath = path.join(servicePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`⚠️  No package.json found for ${serviceName}`);
    return {
      service: serviceName,
      status: 'no_package_json',
      coverage: 0,
      tests: { passed: 0, failed: 0, total: 0 }
    };
  }

  return new Promise((resolve) => {
    const testProcess = spawn('npm', ['test'], {
      cwd: servicePath,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    testProcess.on('close', (code) => {
      const result = parseTestOutput(serviceName, output, errorOutput, code);
      console.log(`${result.status === 'passed' ? '✅' : '❌'} ${serviceName}: ${result.summary}`);
      resolve(result);
    });
  });
}

function parseTestOutput(serviceName, output, errorOutput, exitCode) {
  const result = {
    service: serviceName,
    status: exitCode === 0 ? 'passed' : 'failed',
    coverage: 0,
    tests: { passed: 0, failed: 0, total: 0 },
    summary: '',
    details: output
  };

  // Parse test results
  const testSuitesMatch = output.match(/Test Suites:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  if (testSuitesMatch) {
    const [, failed, passed, total] = testSuitesMatch;
    result.tests = {
      passed: parseInt(passed),
      failed: parseInt(failed),
      total: parseInt(total)
    };
  }

  // Parse individual tests
  const testsMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  if (testsMatch) {
    const [, failed, passed, total] = testsMatch;
    result.tests.individual = {
      passed: parseInt(passed),
      failed: parseInt(failed),
      total: parseInt(total)
    };
  }

  // Parse coverage percentage
  const coverageMatch = output.match(/All files[^\n]*\|\s+([0-9.]+)/);
  if (coverageMatch) {
    result.coverage = parseFloat(coverageMatch[1]);
  }

  // Create summary
  if (result.tests.total > 0) {
    const passRate = Math.round((result.tests.passed / result.tests.total) * 100);
    result.summary = `${result.tests.passed}/${result.tests.total} suites (${passRate}%), Coverage: ${result.coverage}%`;
  } else {
    result.summary = 'No tests found';
  }

  return result;
}

async function runCoverageTests(serviceName) {
  console.log(`📊 Running coverage for ${serviceName}...`);
  
  const servicePath = path.join('backend/services', serviceName);
  
  return new Promise((resolve) => {
    const coverageProcess = spawn('npm', ['run', 'test:coverage'], {
      cwd: servicePath,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let output = '';

    coverageProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    coverageProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    coverageProcess.on('close', (code) => {
      const coverageMatch = output.match(/All files[^\n]*\|\s+([0-9.]+)\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)/);
      
      if (coverageMatch) {
        const [, statements, branches, functions, lines] = coverageMatch;
        resolve({
          service: serviceName,
          coverage: {
            statements: parseFloat(statements),
            branches: parseFloat(branches),
            functions: parseFloat(functions),
            lines: parseFloat(lines)
          }
        });
      } else {
        resolve({
          service: serviceName,
          coverage: {
            statements: 0,
            branches: 0,
            functions: 0,
            lines: 0
          }
        });
      }
    });
  });
}

async function generateReport() {
  console.log('🔄 Running tests for all services...\n');
  
  for (const service of services) {
    const result = await runServiceTests(service);
    testResults.push(result);
  }

  console.log('\n📊 Test Coverage Summary');
  console.log('=========================');
  
  let totalTests = 0;
  let totalPassed = 0;
  let totalCoverage = 0;
  let servicesWithCoverage = 0;

  testResults.forEach(result => {
    if (result.tests.total > 0) {
      totalTests += result.tests.total;
      totalPassed += result.tests.passed;
    }
    
    if (result.coverage > 0) {
      totalCoverage += result.coverage;
      servicesWithCoverage++;
    }
  });

  const overallPassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
  const averageCoverage = servicesWithCoverage > 0 ? Math.round(totalCoverage / servicesWithCoverage) : 0;

  console.log(`\n📈 Overall Statistics:`);
  console.log(`   Test Pass Rate: ${totalPassed}/${totalTests} (${overallPassRate}%)`);
  console.log(`   Average Coverage: ${averageCoverage}%`);
  console.log(`   Target Coverage: 80%`);
  console.log(`   Coverage Gap: ${Math.max(0, 80 - averageCoverage)}%`);

  console.log(`\n📋 Service Breakdown:`);
  testResults.forEach(result => {
    const status = result.status === 'passed' ? '✅' : 
                   result.status === 'failed' ? '❌' : '⚠️';
    const coverage = result.coverage > 0 ? `${result.coverage}%` : 'N/A';
    console.log(`   ${status} ${result.service.padEnd(12)} - ${result.summary} - Coverage: ${coverage}`);
  });

  // Identify services that need improvement
  const lowCoverageServices = testResults.filter(r => r.coverage < 80 && r.coverage > 0);
  const failingServices = testResults.filter(r => r.status === 'failed');
  const missingTestServices = testResults.filter(r => r.tests.total === 0);

  if (lowCoverageServices.length > 0) {
    console.log(`\n🎯 Services needing coverage improvement (< 80%):`);
    lowCoverageServices.forEach(service => {
      console.log(`   • ${service.service}: ${service.coverage}% (need +${80 - service.coverage}%)`);
    });
  }

  if (failingServices.length > 0) {
    console.log(`\n🚨 Services with failing tests:`);
    failingServices.forEach(service => {
      console.log(`   • ${service.service}: ${service.tests.failed} failing tests`);
    });
  }

  if (missingTestServices.length > 0) {
    console.log(`\n📝 Services needing test implementation:`);
    missingTestServices.forEach(service => {
      console.log(`   • ${service.service}: No tests found`);
    });
  }

  // Recommendations
  console.log(`\n💡 Recommendations:`);
  
  if (averageCoverage < 80) {
    console.log(`   1. Focus on adding unit tests for core business logic`);
    console.log(`   2. Add integration tests for API endpoints`);
    console.log(`   3. Mock external dependencies properly`);
    console.log(`   4. Test error handling and edge cases`);
  }

  if (failingServices.length > 0) {
    console.log(`   5. Fix failing tests before adding new features`);
    console.log(`   6. Review test setup and mocking configuration`);
  }

  if (missingTestServices.length > 0) {
    console.log(`   7. Implement basic test structure for services without tests`);
    console.log(`   8. Start with happy path tests, then add edge cases`);
  }

  console.log(`\n🎯 Next Steps to Achieve 80% Coverage:`);
  console.log(`   • Add ${Math.max(0, (80 - averageCoverage) * servicesWithCoverage)}% total coverage across all services`);
  console.log(`   • Focus on services with existing test infrastructure`);
  console.log(`   • Prioritize core business logic over utility functions`);
  
  return {
    overallPassRate,
    averageCoverage,
    servicesWithCoverage,
    totalServices: services.length,
    recommendations: lowCoverageServices.length + failingServices.length + missingTestServices.length
  };
}

// Run the report
generateReport().then(summary => {
  console.log(`\n✅ Coverage report complete!`);
  
  if (summary.averageCoverage >= 80) {
    console.log(`🎉 TARGET ACHIEVED! Average coverage: ${summary.averageCoverage}%`);
  } else {
    console.log(`📈 Progress toward 80% target: ${summary.averageCoverage}/80%`);
  }
}).catch(error => {
  console.error('❌ Error generating coverage report:', error);
  process.exit(1);
});
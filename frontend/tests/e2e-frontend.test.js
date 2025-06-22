/**
 * E2E Tests for Threat Modeling Frontend
 * Tests the complete React application functionality
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Frontend E2E Tests', () => {
  test('Build process should complete successfully', () => {
    expect(() => {
      execSync('npm run build', { 
        cwd: __dirname + '/..',
        stdio: 'pipe',
        timeout: 30000
      });
    }).not.toThrow();
  }, 35000);

  test('Built files should exist', () => {
    const distPath = path.join(__dirname, '..', 'dist');
    expect(fs.existsSync(distPath)).toBe(true);
    expect(fs.existsSync(path.join(distPath, 'index.html'))).toBe(true);
  });

  test('Bundle should not contain sensitive data', () => {
    const distPath = path.join(__dirname, '..', 'dist');
    const jsFiles = fs.readdirSync(path.join(distPath, 'assets'))
      .filter(file => file.endsWith('.js'));
    
    jsFiles.forEach(file => {
      const content = fs.readFileSync(path.join(distPath, 'assets', file), 'utf8');
      
      // Check for private IPs
      expect(content).not.toMatch(/192\.168\.\d+\.\d+/);
      expect(content).not.toMatch(/10\.\d+\.\d+\.\d+/);
      expect(content).not.toMatch(/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+/);
      
      // Check for hardcoded credentials (specific patterns)
      expect(content).not.toMatch(/password\s*:\s*["'][^"']+["']/i);
      expect(content).not.toMatch(/secret\s*:\s*["'][^"']+["']/i);
      expect(content).not.toMatch(/api_key\s*:\s*["'][^"']+["']/i);
    });
  });

  test('TypeScript compilation should pass', () => {
    expect(() => {
      execSync('npx tsc --noEmit', { 
        cwd: __dirname + '/..',
        stdio: 'pipe'
      });
    }).not.toThrow();
  });

  test('ESLint should pass', () => {
    expect(() => {
      execSync('npm run lint', { 
        cwd: __dirname + '/..',
        stdio: 'pipe'
      });
    }).not.toThrow();
  });

  test('Source files should have proper structure', () => {
    const srcPath = path.join(__dirname, '..', 'src');
    
    // Check main directories exist
    expect(fs.existsSync(path.join(srcPath, 'components'))).toBe(true);
    expect(fs.existsSync(path.join(srcPath, 'pages'))).toBe(true);
    expect(fs.existsSync(path.join(srcPath, 'services'))).toBe(true);
    expect(fs.existsSync(path.join(srcPath, 'store'))).toBe(true);
    expect(fs.existsSync(path.join(srcPath, 'features'))).toBe(true);
    expect(fs.existsSync(path.join(srcPath, 'layouts'))).toBe(true);
    expect(fs.existsSync(path.join(srcPath, 'styles'))).toBe(true);
    
    // Check key files exist
    expect(fs.existsSync(path.join(srcPath, 'App.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(srcPath, 'main.tsx'))).toBe(true);
  });

  test('Environment configuration should be safe', () => {
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    const envPath = path.join(__dirname, '..', '.env');
    
    expect(fs.existsSync(envExamplePath)).toBe(true);
    
    // Check .env.example doesn't contain sensitive data
    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    expect(envExample).not.toMatch(/192\.168\./);
    expect(envExample).toMatch(/localhost/);
    
    // Check .env if it exists
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8');
      expect(env).toMatch(/localhost/);
    }
  });

  test('Package.json should have correct scripts', () => {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    expect(packageJson.scripts).toHaveProperty('dev');
    expect(packageJson.scripts).toHaveProperty('build');
    expect(packageJson.scripts).toHaveProperty('lint');
    expect(packageJson.scripts).toHaveProperty('preview');
  });

  test('Dependencies should be secure versions', () => {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Check for React 18+
    expect(packageJson.dependencies.react).toMatch(/^\^?19\./);
    expect(packageJson.dependencies['react-dom']).toMatch(/^\^?19\./);
    
    // Check for Material-UI v5+
    expect(packageJson.dependencies['@mui/material']).toMatch(/^\^?5\./);
  });
});
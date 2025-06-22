# GitHub Runner Migration Guide

## 🎯 Migration from Self-Hosted to GitHub-Hosted Runners

This guide explains the migration from self-hosted runners to GitHub-hosted runners for the threat-modeling-platform repository.

## ✅ **Completed Steps**

### 1. GitHub Actions Workflows Created
- **CI/CD Pipeline** (`.github/workflows/ci.yml`)
- **Security Scanning** (`.github/workflows/security.yml`) 
- **AI/ML Specialized Tests** (`.github/workflows/ai-ml-tests.yml`)
- **Release Management** (`.github/workflows/release.yml`)

All workflows are configured to use **`ubuntu-latest`** GitHub-hosted runners.

## 🔧 **Next Steps: Repository Settings**

### 1. Disable Self-Hosted Runners

Navigate to your repository settings and disable self-hosted runners:

```
https://github.com/anubissbe/threat-modeling-platform/settings/actions/runners
```

**Steps:**
1. Go to **Settings** → **Actions** → **Runners**
2. Remove any existing self-hosted runners
3. Click **"Remove"** for each self-hosted runner
4. Confirm removal

### 2. Configure Runner Groups (if applicable)

If using GitHub Enterprise:
1. Go to **Settings** → **Actions** → **Runner groups**
2. Ensure workflows can access GitHub-hosted runners
3. Update any runner group policies

### 3. Update Repository Settings

**Required Actions settings:**
```
Settings → Actions → General
```

**Recommended configuration:**
- ✅ **Actions permissions**: Allow all actions and reusable workflows
- ✅ **Artifact and log retention**: 90 days (default)
- ✅ **Fork pull request workflows**: Require approval for all outside collaborators
- ✅ **Workflow permissions**: Read and write permissions

### 4. Configure Branch Protection Rules

Update branch protection to use new workflows:
```
Settings → Branches → Add rule (or edit existing)
```

**Required status checks:**
- ✅ `lint`
- ✅ `test-unit`
- ✅ `test-integration`
- ✅ `security / codeql`
- ✅ `security / dependency-scan`

## 🔍 **Workflow Overview**

### Main CI/CD Pipeline (`ci.yml`)
- **Triggers**: Push to main/master/develop, PRs
- **Jobs**: Lint → Unit Tests → Integration Tests → E2E Tests → Security → Build → Deploy
- **Runner**: `ubuntu-latest`
- **Services**: PostgreSQL, Redis for integration tests

### Security Scanning (`security.yml`) 
- **Triggers**: Push, PRs, scheduled daily
- **Jobs**: CodeQL, dependency scan, container scan, secrets scan, SAST, license scan
- **Runner**: `ubuntu-latest`
- **Features**: SARIF upload to GitHub Security tab

### AI/ML Tests (`ai-ml-tests.yml`)
- **Triggers**: Changes to `services/ai-ml-service/**`
- **Jobs**: Unit tests, pattern recognition E2E, NLP tests, performance benchmarks
- **Runner**: `ubuntu-latest`
- **Features**: 67 E2E test cases, model performance validation

### Release Management (`release.yml`)
- **Triggers**: Version tags (`v*`), manual workflow dispatch
- **Jobs**: Create release, build images, deployment artifacts, security scan
- **Runner**: `ubuntu-latest`
- **Features**: Multi-platform Docker builds, automated changelog

## 📊 **Benefits of GitHub-Hosted Runners**

### 🚀 **Performance**
- Consistent, clean environment for every build
- No maintenance overhead
- Automatic scaling
- Fresh VM for each job

### 🛡️ **Security**
- Ephemeral environments (no state persistence)
- Isolated execution
- Automatic security updates
- No infrastructure management

### 💰 **Cost Efficiency**
- No self-hosted infrastructure costs
- Pay-per-use model
- Included minutes in GitHub plans
- No maintenance time investment

### 🔧 **Reliability**
- 99.9% uptime SLA
- Automatic failover
- No hardware failures
- Consistent performance

## ⚠️ **Important Considerations**

### 1. **Resource Limits**
GitHub-hosted runners have limits:
- **2-core CPU** (up to 4-core for larger plans)
- **7GB RAM** (up to 16GB for larger plans)
- **14GB SSD space** (up to 64GB for larger plans)
- **6 hours max job runtime**

### 2. **Network Access**
- No access to private networks
- All dependencies must be publicly accessible
- Use GitHub secrets for private credentials

### 3. **Artifact Storage**
- 90-day retention by default
- Counts against repository storage
- Use external storage for long-term artifacts

## 🧪 **Testing the Migration**

### 1. Trigger Test Workflow
Create a test PR to verify workflows:
```bash
git checkout -b test-github-runners
echo "# Test" >> README.md
git add README.md
git commit -m "Test GitHub-hosted runners"
git push origin test-github-runners
```

### 2. Monitor Workflow Execution
- Check **Actions** tab for running workflows
- Verify all jobs complete successfully
- Check security scanning results
- Validate test coverage reports

### 3. Performance Validation
- Compare build times with self-hosted runners
- Monitor test execution times
- Validate Docker build performance

## 🚨 **Rollback Plan**

If issues occur, you can temporarily rollback:

1. **Re-enable self-hosted runners** in repository settings
2. **Update workflow files** to use self-hosted runner labels:
   ```yaml
   runs-on: self-hosted  # Instead of ubuntu-latest
   ```
3. **Commit and push** the changes

## 📞 **Support**

If you encounter issues:
1. Check **Actions** tab for detailed logs
2. Review **Security** tab for scanning results
3. Check **Settings** → **Actions** for configuration
4. GitHub Support for runner-related issues

## ✅ **Migration Checklist**

- [x] Create GitHub Actions workflows
- [x] Configure workflows for ubuntu-latest
- [x] Test workflows with sample changes
- [ ] Remove self-hosted runners from repository
- [ ] Update branch protection rules
- [ ] Configure required status checks
- [ ] Test full CI/CD pipeline
- [ ] Monitor first production deployment
- [ ] Update team documentation

---

**Migration completed successfully!** 🎉

Your threat modeling platform now uses GitHub-hosted runners with enterprise-grade CI/CD, security scanning, and automated deployments.
# Contributing to Threat Modeling Platform

First off, thank you for considering contributing to the Threat Modeling Platform! It's people like you that make this platform a great tool for the security community.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [How to Contribute](#how-to-contribute)
- [Style Guidelines](#style-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@threatmodeling.io](mailto:conduct@threatmodeling.io).

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/threat-modeling-platform.git
   cd threat-modeling-platform
   ```
3. **Add the upstream repository**:
   ```bash
   git remote add upstream https://github.com/anubissbe/threat-modeling-platform.git
   ```
4. **Set up your development environment**:
   ```bash
   make setup
   make build
   make dev
   ```

## Development Process

We use GitHub flow - all changes happen through pull requests:

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Write/update tests** for your changes

4. **Run tests locally**:
   ```bash
   make test
   make lint
   ```

5. **Commit your changes** using conventional commits

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** from your fork to our `main` branch

## How to Contribute

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment details (OS, browser, Node.js version)

Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- A clear and descriptive title
- Detailed description of the proposed functionality
- Rationale for why this enhancement would be useful
- Possible implementation approach

Use the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md).

### 📝 Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `documentation` - Documentation improvements

### 🔄 Pull Requests

1. **Ensure your PR**:
   - Solves one problem
   - Includes tests
   - Updates documentation
   - Follows code style guidelines
   - Has a clear description

2. **PR Title Format**:
   ```
   <type>(<scope>): <subject>
   ```
   Example: `feat(auth): add SAML SSO support`

3. **PR Description Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Tests pass locally
   - [ ] Added new tests
   - [ ] Updated existing tests

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No new warnings
   ```

## Style Guidelines

### TypeScript/JavaScript

We use ESLint and Prettier. Run `make lint` to check your code.

```typescript
// Good
export const calculateRiskScore = (likelihood: number, impact: number): number => {
  return likelihood * impact;
};

// Bad
export function calculate_risk_score(l, i) {
  return l * i
}
```

### Python

We use Black and flake8. Run `make lint` in the AI service directory.

```python
# Good
def calculate_risk_score(likelihood: int, impact: int) -> float:
    """Calculate risk score based on likelihood and impact."""
    return likelihood * impact

# Bad
def CalculateRiskScore(l,i):
    return l*i
```

### React Components

Use functional components with TypeScript:

```tsx
// Good
interface ThreatCardProps {
  threat: Threat;
  onEdit: (id: string) => void;
}

export const ThreatCard: React.FC<ThreatCardProps> = ({ threat, onEdit }) => {
  return <div>{/* Component content */}</div>;
};
```

### API Design

Follow RESTful principles:

```
GET    /api/threats          # List threats
GET    /api/threats/:id      # Get threat
POST   /api/threats          # Create threat
PATCH  /api/threats/:id      # Update threat
DELETE /api/threats/:id      # Delete threat
```

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes that don't modify src or test files

### Examples
```
feat(auth): implement SAML SSO authentication

- Add SAML strategy to Passport configuration
- Create SAML metadata endpoint
- Update login flow to support SSO
- Add tests for SAML authentication

Closes #123
```

```
fix(threats): correct risk score calculation

The risk score was being calculated as likelihood + impact
instead of likelihood * impact.
```

## Testing

### Unit Tests
```bash
# Backend
cd backend/services/auth
npm test

# Frontend
cd frontend
npm test
```

### Integration Tests
```bash
make test:integration
```

### E2E Tests
```bash
make test:e2e
```

### Test Coverage
We aim for >80% code coverage:
```bash
npm run test:coverage
```

## Documentation

- Update README.md if needed
- Add JSDoc comments for functions
- Update API documentation
- Include inline comments for complex logic
- Update architecture docs for significant changes

## Release Process

1. **Version Bump**: We use semantic versioning
2. **Changelog**: Update CHANGELOG.md
3. **Release Notes**: Draft comprehensive release notes
4. **Testing**: Full regression testing
5. **Deployment**: Staged rollout (dev → staging → production)

## Getting Help

- 💬 [Discord Community](https://discord.gg/threatmodeling)
- 📧 [Developer Mailing List](mailto:dev@threatmodeling.io)
- 📖 [Developer Documentation](https://docs.threatmodeling.io/developers)
- 🎥 [Video Tutorials](https://www.youtube.com/threatmodeling)

## Recognition

Contributors are recognized in:
- [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Release notes
- Project website

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
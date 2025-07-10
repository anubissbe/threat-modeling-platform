# TMAC - Threat Modeling as Code

TMAC (Threat Modeling as Code) enables security teams and developers to define, version, and analyze threat models using YAML or JSON files. This approach brings DevSecOps principles to threat modeling.

## Features

- **Version Control**: Threat models as code can be versioned, diffed, and reviewed like any other code
- **CI/CD Integration**: Validate and analyze threat models in your pipeline
- **Standardized Format**: Consistent schema based on industry standards (STRIDE, MITRE ATT&CK)
- **Automated Analysis**: Built-in security analysis and compliance checking
- **Extensible**: Easy to integrate with existing tools and workflows

## Quick Start

### Installation

```bash
# Install CLI globally
npm install -g @threatmodeling/tmac-cli

# Or use in your project
npm install @threatmodeling/tmac-core
```

### Basic Usage

1. **Create a threat model** (`app-threatmodel.tmac.yaml`):

```yaml
version: "1.0.0"

metadata:
  name: "My Application Threat Model"
  author: "Security Team"
  created: "2025-01-10T10:00:00Z"
  updated: "2025-01-10T10:00:00Z"

system:
  name: "My Web Application"
  type: "web"
  architecture: "microservices"
  components:
    - id: "web-app"
      name: "Web Frontend"
      type: "frontend"
      trust: "untrusted"
      authentication: "jwt"
      dataClassification: "internal"

    - id: "api"
      name: "REST API"
      type: "api"
      trust: "semi-trusted"
      authentication: "jwt"
      dataClassification: "confidential"

    - id: "database"
      name: "User Database"
      type: "database"
      trust: "trusted"
      encryption:
        atRest: true
        inTransit: true
      dataClassification: "confidential"

dataFlows:
  - id: "df-001"
    name: "User Login"
    source: "web-app"
    destination: "api"
    protocol: "https"
    authentication: true
    encryption: true

  - id: "df-002"
    name: "API to Database"
    source: "api"
    destination: "database"
    protocol: "tcp"
    authentication: true
    encryption: true

threats:
  - id: "T001"
    name: "SQL Injection"
    category: "tampering"
    severity: "high"
    likelihood: "possible"
    components: ["api", "database"]
    dataFlows: ["df-002"]

mitigations:
  - id: "M001"
    name: "Use Parameterized Queries"
    threats: ["T001"]
    status: "implemented"
    priority: "high"
```

2. **Validate the threat model**:

```bash
tmac validate app-threatmodel.tmac.yaml
```

3. **Analyze for security findings**:

```bash
tmac analyze app-threatmodel.tmac.yaml
```

## CLI Commands

### `tmac validate <file>`
Validates a TMAC file against the schema and best practices.

```bash
tmac validate threatmodel.yaml
tmac validate threatmodel.yaml --verbose
```

### `tmac analyze <file>`
Analyzes a threat model for security findings and recommendations.

```bash
tmac analyze threatmodel.yaml
tmac analyze threatmodel.yaml --output json
```

### `tmac info <file>`
Displays summary information about a threat model.

```bash
tmac info threatmodel.yaml
```

### `tmac convert <input> <output>`
Converts between YAML and JSON formats.

```bash
tmac convert model.yaml model.json
tmac convert model.json model.yaml
```

### `tmac merge <files...>`
Merges multiple threat models into one.

```bash
tmac merge model1.yaml model2.yaml --output merged.yaml
```

## Schema Reference

### Root Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | string | Yes | TMAC schema version (e.g., "1.0.0") |
| metadata | Metadata | Yes | Model metadata |
| system | System | Yes | System architecture description |
| dataFlows | DataFlow[] | Yes | Data flow definitions |
| threats | Threat[] | Yes | Identified threats |
| mitigations | Mitigation[] | No | Mitigation controls |
| assumptions | string[] | No | Security assumptions |
| outOfScope | string[] | No | Out of scope items |

### Key Types

#### Component
- `id`: Unique identifier
- `name`: Component name
- `type`: Component type (webserver, database, api, etc.)
- `trust`: Trust level (trusted, untrusted, semi-trusted)
- `encryption`: Encryption configuration
- `authentication`: Authentication method
- `dataClassification`: Data sensitivity level

#### Threat
- `id`: Unique threat ID (e.g., T001)
- `name`: Threat name
- `category`: STRIDE category
- `severity`: critical, high, medium, low, info
- `components`: Affected component IDs
- `cvssScore`: CVSS 3.1 score (optional)
- `mitreAttack`: MITRE ATT&CK mapping (optional)

#### Mitigation
- `id`: Unique mitigation ID (e.g., M001)
- `name`: Mitigation name
- `threats`: Threat IDs addressed
- `status`: planned, in-progress, implemented, verified
- `priority`: critical, high, medium, low

## CI/CD Integration

### GitHub Actions

```yaml
name: Threat Model Validation

on:
  pull_request:
    paths:
      - '**/*.tmac.yaml'
      - '**/*.tmac.yml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install TMAC CLI
        run: npm install -g @threatmodeling/tmac-cli
      
      - name: Validate Threat Models
        run: |
          find . -name "*.tmac.yaml" -o -name "*.tmac.yml" | while read file; do
            echo "Validating $file"
            tmac validate "$file"
          done
      
      - name: Analyze Threat Models
        run: |
          find . -name "*.tmac.yaml" -o -name "*.tmac.yml" | while read file; do
            echo "Analyzing $file"
            tmac analyze "$file"
          done
```

### GitLab CI

```yaml
threat-model-validation:
  stage: security
  image: node:18
  script:
    - npm install -g @threatmodeling/tmac-cli
    - find . -name "*.tmac.yaml" -exec tmac validate {} \;
    - find . -name "*.tmac.yaml" -exec tmac analyze {} \;
  only:
    changes:
      - "**/*.tmac.yaml"
      - "**/*.tmac.yml"
```

## Programmatic Usage

```typescript
import { 
  TMACParser, 
  TMACValidator, 
  TMACAnalyzer 
} from '@threatmodeling/tmac-core';

// Parse a threat model
const model = await TMACParser.parseFile('threatmodel.yaml');

// Validate
const validation = await TMACValidator.validate(model);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// Analyze
const analysis = TMACAnalyzer.analyze(model);
console.log('Risk Score:', analysis.riskScore);
console.log('Findings:', analysis.findings);
```

## Best Practices

1. **Version Control**: Store TMAC files in your repository alongside code
2. **Regular Updates**: Update threat models when architecture changes
3. **Peer Review**: Review threat model changes in pull requests
4. **Automation**: Integrate validation in CI/CD pipelines
5. **Naming Convention**: Use descriptive IDs (e.g., T001-sql-injection)
6. **Documentation**: Add descriptions to threats and mitigations
7. **Compliance Mapping**: Map threats to CWE IDs and MITRE ATT&CK

## Examples

See the `/examples` directory for complete threat model examples:
- `ecommerce-platform.tmac.yaml` - E-commerce platform
- `mobile-banking.tmac.yaml` - Mobile banking application
- `iot-device.tmac.yaml` - IoT device threat model
- `cloud-saas.tmac.yaml` - Cloud SaaS application

## Contributing

We welcome contributions! Please see CONTRIBUTING.md for guidelines.

## License

MIT License - see LICENSE file for details.
# TMAC (Threat Modeling as Code) Feature Guide

## Overview

TMAC (Threat Modeling as Code) is a powerful feature that allows security teams to define, version, and manage threat models using YAML or JSON files. This approach brings software development best practices to threat modeling, enabling version control, CI/CD integration, and automated validation.

## Key Features

### 1. Declarative Threat Modeling
- Define threat models in human-readable YAML or JSON format
- Version control threat models alongside application code
- Enable collaborative threat modeling through pull requests

### 2. Comprehensive Validation
- Schema validation ensures correct structure
- Business rule validation catches security issues
- Real-time feedback on model completeness and quality

### 3. Advanced Analysis
- Automatic risk scoring based on threat severity and mitigation coverage
- STRIDE methodology integration
- MITRE ATT&CK framework mapping
- Compliance assessment (PCI-DSS, GDPR, SOC2, etc.)

### 4. CI/CD Integration
- CLI tool for automation pipelines
- Pre-commit hooks for validation
- GitHub Actions integration
- Jenkins pipeline support

### 5. Format Flexibility
- Convert between YAML and JSON formats
- Merge multiple threat models
- Export from existing threat models to TMAC format
- Import TMAC files into the platform

## Using TMAC in the Platform

### Accessing TMAC Editor

1. Navigate to the threat modeling platform
2. Click on "TMAC Editor" in the sidebar (marked with "New" badge)
3. Start creating a new TMAC file or import an existing one

### Editor Features

#### Validation
- Click "Validate" to check your TMAC file for errors
- View detailed error messages and warnings
- Get suggestions for improvements

#### Analysis
- Click "Analyze" to get comprehensive security insights
- View risk scores and threat coverage
- Get actionable recommendations

#### Format Conversion
- Convert between YAML and JSON with one click
- Maintains all model information during conversion
- Automatic formatting and indentation

#### File Operations
- Upload existing TMAC files via drag-and-drop
- Download your work as `.tmac.yaml` or `.tmac.json`
- Import from existing threat models in the platform

### Integration with Threat Models

1. **Creating from TMAC**:
   - Create your threat model in TMAC format
   - Save it to create a new threat model in the platform
   - All TMAC data is preserved and accessible

2. **Exporting to TMAC**:
   - Open any existing threat model
   - Navigate to the TMAC editor
   - Click "Import from Platform" to convert

3. **Round-trip Editing**:
   - Export threat model to TMAC
   - Edit in your favorite text editor
   - Import back with changes preserved

## TMAC Schema

### Basic Structure

```yaml
version: "1.0.0"
metadata:
  name: "Application Name"
  description: "Brief description"
  author: "Security Team"
  version: "1.0.0"
  tags:
    - web-application
    - cloud
  compliance:
    - PCI-DSS
    - GDPR

system:
  name: "System Name"
  description: "System description"
  type: "web-application"
  components:
    - id: "web-app"
      name: "Web Application"
      type: "web_application"
      technologies:
        - "React"
        - "Node.js"
      trustLevel: "high"

dataFlows:
  - id: "df1"
    name: "User Login"
    source: "user"
    destination: "web-app"
    protocol: "HTTPS"
    authentication: "OAuth2"
    data:
      - "credentials"
      - "session-token"

threats:
  - id: "T1"
    name: "SQL Injection"
    component: "web-app"
    category: "tampering"
    severity: "high"
    description: "Attacker could inject SQL commands"
    stride: ["T"]
    mitre:
      tactics: ["TA0001"]
      techniques: ["T1190"]
    cvss: 8.5
    likelihood: "medium"
    impact: "high"
    mitigations:
      - "M1"

mitigations:
  - id: "M1"
    name: "Input Validation"
    description: "Validate and sanitize all user inputs"
    type: "preventive"
    implemented: true
    threats:
      - "T1"
```

## Best Practices

### 1. Version Control
- Store TMAC files in your application repository
- Use meaningful commit messages
- Review changes through pull requests

### 2. Naming Conventions
- Use consistent ID formats (e.g., `T001`, `M001`)
- Use descriptive names for components and threats
- Follow your organization's naming standards

### 3. Threat Coverage
- Ensure all components have associated threats
- Cover all STRIDE categories where applicable
- Link threats to appropriate mitigations

### 4. Documentation
- Add clear descriptions to all elements
- Include rationale for security decisions
- Document assumptions and constraints

### 5. Automation
- Set up CI/CD validation
- Automate threat model updates
- Generate reports from TMAC files

## CLI Usage

### Installation
```bash
npm install -g @threatmodeling/tmac-cli
```

### Commands

#### Validate
```bash
tmac validate threat-model.yaml
```

#### Analyze
```bash
tmac analyze threat-model.yaml --output report.json
```

#### Convert
```bash
tmac convert threat-model.yaml threat-model.json
```

#### Merge
```bash
tmac merge model1.yaml model2.yaml --output merged.yaml
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Threat Model Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g @threatmodeling/tmac-cli
      - run: tmac validate threat-models/**/*.yaml
      - run: tmac analyze threat-models/**/*.yaml --fail-on-high
```

### Jenkins Pipeline
```groovy
pipeline {
  agent any
  stages {
    stage('Validate Threat Models') {
      steps {
        sh 'npm install -g @threatmodeling/tmac-cli'
        sh 'tmac validate threat-models/**/*.yaml'
        sh 'tmac analyze threat-models/**/*.yaml --output reports/'
      }
    }
  }
}
```

### Pre-commit Hook
```yaml
repos:
  - repo: local
    hooks:
      - id: tmac-validate
        name: Validate TMAC files
        entry: tmac validate
        language: system
        files: \.tmac\.(yaml|yml|json)$
```

## API Integration

### Backend Service
The TMAC service runs on port 3010 and provides REST APIs:

- `POST /api/tmac/parse` - Parse TMAC file
- `POST /api/tmac/validate` - Validate TMAC file
- `POST /api/tmac/analyze` - Analyze threat model
- `POST /api/tmac/convert` - Convert between formats
- `POST /api/tmac/merge` - Merge multiple models

### Example API Usage
```javascript
// Parse TMAC file
const formData = new FormData();
formData.append('file', tmacFile);

const response = await fetch('/api/tmac/validate', {
  method: 'POST',
  body: formData
});

const { validation, model } = await response.json();
```

## Troubleshooting

### Common Issues

1. **Validation Errors**
   - Check YAML/JSON syntax
   - Ensure all required fields are present
   - Verify ID references are correct

2. **Analysis Warnings**
   - Review unmitigated threats
   - Check threat coverage percentages
   - Ensure compliance requirements are met

3. **Import/Export Issues**
   - Verify file format matches extension
   - Check for special characters in content
   - Ensure proper authentication

### Support

For issues or feature requests:
- Create an issue in the repository
- Contact the security team
- Check the documentation wiki

## Future Enhancements

- **Visual Editor**: Graphical TMAC editor with syntax highlighting
- **Template Library**: Pre-built TMAC templates for common architectures
- **Threat Intelligence**: Automatic threat suggestions based on components
- **Compliance Mapping**: Automated compliance assessment
- **Risk Metrics**: Advanced risk calculation and trending
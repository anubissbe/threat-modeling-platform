# Threat Modeling as Code (TMAC) Architecture

## Overview
Threat Modeling as Code (TMAC) represents a paradigm shift in how threat models are created, managed, and integrated into modern DevSecOps workflows. This document outlines the architecture and implementation of TMAC capabilities within the Threat Modeling Application.

## TMAC Service Architecture

### Service Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                      TMAC Service                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Parser    │  │     DSL     │  │  Generator  │            │
│  │   Engine    │  │   Engine    │  │   Engine    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Version   │  │  Validator  │  │     CLI     │            │
│  │   Control   │  │   Engine    │  │  Interface  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Parser Engine
Handles multiple input formats for threat model definitions:

**Supported Formats:**
- **YAML**: Primary format for declarative threat models
- **JSON**: Alternative declarative format
- **HCL**: Terraform-style configuration
- **Python**: Imperative threat modeling scripts
- **TypeScript/JavaScript**: For frontend integration

**Parser Features:**
```yaml
# Example YAML threat model
version: "1.0"
metadata:
  name: "E-commerce Platform"
  author: "security-team"
  methodology: "STRIDE"

system:
  components:
    - id: "web-app"
      type: "web-application"
      technology: ["React", "Node.js"]
      data_processed: ["PII", "payment-data"]
      
    - id: "api-gateway"
      type: "api"
      technology: ["Kong"]
      
  data_flows:
    - from: "web-app"
      to: "api-gateway"
      protocol: "HTTPS"
      data: ["user-credentials", "payment-info"]
      
  trust_boundaries:
    - name: "Internet Boundary"
      crosses: ["web-app", "api-gateway"]
      
threats:
  - id: "T001"
    component: "web-app"
    category: "Spoofing"
    description: "Attacker could spoof user identity"
    likelihood: "medium"
    impact: "high"
    
mitigations:
  - threat_id: "T001"
    control: "Implement MFA"
    status: "planned"
    owner: "auth-team"
```

#### 2. Domain-Specific Language (DSL) Engine

**Custom DSL for Threat Modeling:**
```
// ThreatModel DSL Example
model "E-commerce Platform" {
    metadata {
        version = "1.0"
        team = "security-team"
        compliance = ["PCI-DSS", "GDPR"]
    }
    
    component WebApp {
        type = "frontend"
        technologies = ["React", "TypeScript"]
        exposes = [HTTP(443)]
        processes = ["user-data", "payment-data"]
        
        threat Spoofing {
            description = "User identity spoofing"
            stride = "S"
            
            mitigation {
                control = "MFA"
                implementation = "Auth0"
            }
        }
    }
    
    flow UserLogin {
        from = User
        to = WebApp
        via = Internet
        carries = ["credentials"]
        
        threat ManInTheMiddle {
            description = "Credential interception"
            stride = "T,I"
        }
    }
    
    boundary "DMZ" {
        contains = [WebApp, APIGateway]
    }
}
```

**DSL Features:**
- Type safety and validation
- Auto-completion support
- Methodology-specific constructs
- Reusable templates and modules
- Integration with IDE plugins

#### 3. Generator Engine

**Code Generation Capabilities:**

1. **Diagram Generation**
   ```python
   # From TMAC to visual diagrams
   generator.from_yaml("threat-model.yaml")
           .to_dfd()
           .with_threats_overlay()
           .export("diagrams/system-dfd.png")
   ```

2. **Security Requirements Generation**
   ```yaml
   # Auto-generated from threat model
   security_requirements:
     - id: "SEC-001"
       source: "T001"
       requirement: "System shall implement multi-factor authentication"
       priority: "high"
       verification: "Authentication flow testing"
   ```

3. **Infrastructure as Code Security Policies**
   ```hcl
   # Generated Terraform security group
   resource "aws_security_group" "web_app" {
     name        = "web-app-sg"
     description = "Generated from threat model"
     
     ingress {
       from_port   = 443
       to_port     = 443
       protocol    = "tcp"
       cidr_blocks = ["0.0.0.0/0"]
     }
     
     # Additional rules based on threat model
   }
   ```

4. **Test Case Generation**
   ```python
   # Generated security test cases
   def test_authentication_spoofing():
       """Test for threat T001: User identity spoofing"""
       # Test MFA implementation
       response = auth_api.login(username="test", password="pass")
       assert response.requires_mfa == True
   ```

#### 4. Version Control Integration

**Git Integration Features:**
- Automatic threat model versioning
- Diff visualization for threat model changes
- Branch protection for threat model updates
- Merge conflict resolution for TMAC files

**Example Workflow:**
```bash
# Clone repository with threat models
git clone https://github.com/company/threat-models.git

# Create feature branch
git checkout -b feature/add-payment-threats

# Edit threat model
tmac edit models/ecommerce.yaml

# Validate changes
tmac validate models/ecommerce.yaml

# View diff
tmac diff models/ecommerce.yaml

# Commit and push
git add models/ecommerce.yaml
git commit -m "Add payment processing threats"
git push origin feature/add-payment-threats
```

#### 5. Validator Engine

**Validation Capabilities:**
- Schema validation for TMAC files
- Methodology compliance checking
- Threat coverage analysis
- Consistency validation across models

**Validation Rules:**
```yaml
validation_rules:
  - rule: "all-components-have-threats"
    severity: "error"
    message: "Component {{component}} has no threats identified"
    
  - rule: "high-risk-needs-mitigation"
    severity: "warning"
    message: "High risk threat {{threat}} lacks mitigation"
    
  - rule: "stride-coverage"
    severity: "info"
    message: "Missing STRIDE categories: {{missing}}"
```

#### 6. CLI Interface

**Command-Line Tool:**
```bash
# Initialize new threat model
tmac init --template web-app --methodology STRIDE

# Import from existing diagram
tmac import --from diagram.drawio --to model.yaml

# Validate threat model
tmac validate model.yaml --strict

# Generate outputs
tmac generate model.yaml --output-format dfd,report,requirements

# Analyze threat coverage
tmac analyze model.yaml --check-methodology STRIDE

# Start interactive editor
tmac edit model.yaml --interactive

# CI/CD integration
tmac ci --model model.yaml --fail-on error
```

### Integration with Other Services

#### 1. Diagram Service Integration
```javascript
// TMAC to Diagram Service API
const tmacModel = await tmacService.parse('model.yaml');
const diagram = await diagramService.generateFromTMAC(tmacModel, {
  type: 'DFD',
  includeThreats: true,
  layout: 'hierarchical'
});
```

#### 2. Threat Engine Integration
```python
# TMAC model analysis
threat_model = tmac_service.load_model('model.yaml')
threats = threat_engine.analyze_model(threat_model)
suggestions = ai_service.suggest_additional_threats(threat_model)
```

#### 3. CI/CD Pipeline Integration

**GitHub Actions Example:**
```yaml
name: Threat Model Validation

on:
  pull_request:
    paths:
      - 'threat-models/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup TMAC CLI
        uses: threat-modeling/setup-tmac@v1
        
      - name: Validate Threat Models
        run: |
          tmac validate threat-models/**/*.yaml
          
      - name: Check Threat Coverage
        run: |
          tmac analyze threat-models/**/*.yaml --min-coverage 80
          
      - name: Generate Reports
        run: |
          tmac generate threat-models/**/*.yaml --format markdown
          
      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const report = fs.readFileSync('threat-model-report.md', 'utf8');
            github.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
```

### TMAC Storage Architecture

#### Database Schema
```sql
-- TMAC models storage
CREATE TABLE tmac_models (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL, -- yaml, json, dsl
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    UNIQUE(project_id, name, version)
);

-- TMAC model history
CREATE TABLE tmac_model_history (
    id UUID PRIMARY KEY,
    model_id UUID REFERENCES tmac_models(id),
    version VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TMAC templates
CREATE TABLE tmac_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- web-app, microservice, mobile, etc.
    methodology VARCHAR(50), -- STRIDE, PASTA, etc.
    template_content TEXT NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints

#### TMAC REST API
```yaml
paths:
  /api/v1/tmac/models:
    post:
      summary: Create new TMAC model
      requestBody:
        content:
          application/yaml:
            schema:
              type: string
          application/json:
            schema:
              $ref: '#/components/schemas/TmacModel'
              
  /api/v1/tmac/models/{id}:
    get:
      summary: Get TMAC model
      parameters:
        - name: format
          in: query
          schema:
            type: string
            enum: [yaml, json, dsl]
            
  /api/v1/tmac/validate:
    post:
      summary: Validate TMAC model
      requestBody:
        content:
          application/yaml:
            schema:
              type: string
              
  /api/v1/tmac/generate:
    post:
      summary: Generate artifacts from TMAC
      parameters:
        - name: output
          in: query
          schema:
            type: array
            items:
              type: string
              enum: [dfd, requirements, tests, iac]
              
  /api/v1/tmac/diff:
    post:
      summary: Compare two TMAC models
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                base:
                  type: string
                compare:
                  type: string
```

### IDE Integration

#### VS Code Extension Features
- Syntax highlighting for TMAC DSL
- Auto-completion for threat categories
- Real-time validation
- Visual preview of diagrams
- Quick actions for adding threats/mitigations
- Integration with Git for version control

#### IntelliJ Plugin Features
- TMAC file type recognition
- Code inspection for threat models
- Refactoring support
- Navigation between model elements
- Integration with project threat models

### Best Practices for TMAC

1. **Version Control Everything**
   - Store all threat models in Git
   - Use semantic versioning for models
   - Tag releases with threat model versions

2. **Modular Design**
   - Break large systems into modules
   - Use imports/includes for reusability
   - Create template libraries

3. **Automation First**
   - Integrate with CI/CD pipelines
   - Automate validation and testing
   - Generate documentation automatically

4. **Progressive Enhancement**
   - Start with basic YAML/JSON
   - Add custom DSL features gradually
   - Maintain backwards compatibility

5. **Collaboration Patterns**
   - Use pull requests for threat model changes
   - Require security team review
   - Document decisions in comments

## Migration Strategy

### From Existing Tools
```python
# Migration utilities
from tmac import migrator

# From Microsoft TMT
tmt_model = migrator.from_tmt("model.tm7")
yaml_model = migrator.to_yaml(tmt_model)

# From draw.io diagrams
diagram = migrator.from_drawio("architecture.drawio")
tmac_model = migrator.extract_threat_model(diagram)

# From IriusRisk
irius_export = migrator.from_iriusrisk("export.xml")
tmac_model = migrator.convert(irius_export)
```

## Future Enhancements

1. **AI-Powered TMAC**
   - Auto-generate threat models from code
   - Suggest threats based on architecture patterns
   - Learn from organization's threat history

2. **Real-time Collaboration**
   - Multi-user editing of TMAC files
   - Conflict resolution for concurrent edits
   - Live preview of changes

3. **Advanced Analytics**
   - Threat model quality metrics
   - Coverage analysis dashboards
   - Trend analysis across versions

4. **Extended Integrations**
   - Direct cloud provider integration
   - Container scanning to TMAC
   - API specification import
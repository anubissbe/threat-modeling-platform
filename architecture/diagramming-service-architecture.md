# Diagramming Service Architecture

## Overview
The Diagramming Service is a specialized microservice responsible for creating, managing, and rendering various types of security and architecture diagrams essential for threat modeling. It provides a comprehensive visual modeling platform supporting multiple diagram types with real-time collaboration capabilities.

## Service Architecture

### Core Components
```
┌─────────────────────────────────────────────────────────────────┐
│                    Diagramming Service                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Diagram   │  │   Render    │  │   Layout    │            │
│  │   Editor    │  │   Engine    │  │   Engine    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Template   │  │   Export    │  │ Validation  │            │
│  │   Library   │  │   Engine    │  │   Engine    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │    Real-    │  │   Version   │  │   Symbol    │            │
│  │    time     │  │   Control   │  │   Library   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Diagram Types

### 1. Data Flow Diagrams (DFD)
Primary diagram type for threat modeling, showing how data moves through the system.

**DFD Elements:**
```javascript
const dfdElements = {
  process: {
    shape: 'circle',
    properties: {
      name: String,
      id: String,
      technology: Array,
      privilegeLevel: String,
      dataProcessed: Array
    }
  },
  dataStore: {
    shape: 'parallel',
    properties: {
      name: String,
      id: String,
      type: ['database', 'file', 'cache', 'queue'],
      encryption: Boolean,
      dataStored: Array
    }
  },
  externalEntity: {
    shape: 'rectangle',
    properties: {
      name: String,
      id: String,
      type: ['user', 'system', 'service'],
      trustLevel: String
    }
  },
  dataFlow: {
    shape: 'arrow',
    properties: {
      name: String,
      protocol: String,
      dataTransmitted: Array,
      encryption: Boolean,
      authentication: String
    }
  },
  trustBoundary: {
    shape: 'dashed-box',
    properties: {
      name: String,
      type: ['network', 'physical', 'process'],
      level: Number
    }
  }
};
```

**DFD Features:**
- Hierarchical levels (Context, Level 0, Level 1, etc.)
- Automatic trust boundary detection
- Data classification overlay
- Threat annotation support
- STRIDE mapping visualization

### 2. Attack Trees
Hierarchical diagrams showing how an asset or target might be attacked.

**Attack Tree Structure:**
```yaml
attack_tree:
  root:
    goal: "Compromise user account"
    operator: "OR"
    children:
      - node:
          attack: "Steal credentials"
          operator: "AND"
          children:
            - attack: "Phishing email"
              cost: "low"
              difficulty: "easy"
              detection: "medium"
            - attack: "Install keylogger"
              cost: "medium"
              difficulty: "medium"
              detection: "hard"
      - node:
          attack: "Brute force"
          operator: "AND"
          children:
            - attack: "Obtain username"
              cost: "low"
              difficulty: "easy"
            - attack: "Dictionary attack"
              cost: "low"
              difficulty: "medium"
```

**Attack Tree Features:**
- AND/OR logic gates
- Cost-benefit analysis
- Success probability calculation
- Countermeasure mapping
- Interactive expansion/collapse

### 3. Architecture Diagrams
High-level system architecture views for context and component relationships.

**Architecture Elements:**
- Components (services, applications)
- Infrastructure (servers, networks)
- Cloud resources (AWS, Azure, GCP icons)
- Communication paths
- Security controls placement

### 4. Sequence Diagrams
For modeling authentication flows and complex interactions.

**Sequence Diagram Support:**
```javascript
sequenceDiagram = {
  actors: ['User', 'WebApp', 'AuthService', 'Database'],
  messages: [
    {from: 'User', to: 'WebApp', message: 'Login Request', type: 'sync'},
    {from: 'WebApp', to: 'AuthService', message: 'Validate Credentials', type: 'async'},
    {from: 'AuthService', to: 'Database', message: 'Check User', type: 'sync'},
    {from: 'Database', to: 'AuthService', message: 'User Data', type: 'return'},
    {from: 'AuthService', to: 'WebApp', message: 'JWT Token', type: 'return'},
    {from: 'WebApp', to: 'User', message: 'Login Success', type: 'return'}
  ]
};
```

### 5. Threat Matrices
Visual representation of threats mapped to components and methodologies.

**Matrix Types:**
- STRIDE per element matrix
- LINDDUN privacy matrix
- Risk heat maps
- Control coverage matrix

## Diagram Editor Features

### 1. Visual Editor Interface
```typescript
interface DiagramEditor {
  // Canvas operations
  canvas: {
    zoom: (level: number) => void;
    pan: (x: number, y: number) => void;
    fit: () => void;
    export: (format: 'png' | 'svg' | 'pdf') => Blob;
  };
  
  // Element operations
  elements: {
    add: (type: ElementType, position: Point) => Element;
    remove: (id: string) => void;
    update: (id: string, properties: any) => void;
    connect: (from: string, to: string, type: ConnectionType) => Connection;
  };
  
  // Diagram operations
  diagram: {
    validate: () => ValidationResult[];
    autoLayout: (algorithm: LayoutAlgorithm) => void;
    importFrom: (format: string, data: any) => void;
    exportTo: (format: string) => any;
  };
}
```

### 2. Smart Features
- **Auto-connect**: Intelligent connection suggestions
- **Snap-to-grid**: Precise element alignment
- **Smart routing**: Automatic path finding for connections
- **Quick actions**: Context menu for common operations
- **Keyboard shortcuts**: Efficient diagram creation

### 3. Collaboration Features
```javascript
// Real-time collaboration using WebSockets
collaborationEngine: {
  // Cursor tracking
  cursors: {
    broadcast: (position: Point, userId: string) => void;
    render: (cursors: Map<string, Cursor>) => void;
  },
  
  // Change synchronization
  changes: {
    broadcast: (change: Change) => void;
    apply: (change: Change) => void;
    resolve: (conflicts: Conflict[]) => void;
  },
  
  // Presence awareness
  presence: {
    join: (diagramId: string, user: User) => void;
    leave: (diagramId: string, userId: string) => void;
    getActive: (diagramId: string) => User[];
  }
}
```

## Rendering Engine

### 1. Technology Stack
- **Frontend**: D3.js for interactive diagrams
- **Canvas**: SVG for scalable graphics
- **Performance**: WebGL for large diagrams
- **Export**: Server-side rendering with Puppeteer

### 2. Rendering Pipeline
```javascript
class RenderEngine {
  render(diagram: Diagram): RenderedDiagram {
    // 1. Parse diagram model
    const parsed = this.parser.parse(diagram);
    
    // 2. Apply layout algorithm
    const layout = this.layoutEngine.apply(parsed, diagram.layoutAlgorithm);
    
    // 3. Apply styling
    const styled = this.styleEngine.apply(layout, diagram.theme);
    
    // 4. Generate SVG/Canvas
    const rendered = this.svgGenerator.generate(styled);
    
    // 5. Add interactivity
    const interactive = this.interactionEngine.bind(rendered);
    
    return interactive;
  }
}
```

## Layout Engine

### 1. Layout Algorithms
```typescript
enum LayoutAlgorithm {
  HIERARCHICAL = 'hierarchical',     // For DFDs and architecture
  FORCE_DIRECTED = 'force-directed', // For network diagrams
  TREE = 'tree',                     // For attack trees
  ORTHOGONAL = 'orthogonal',         // For clean, grid-based layouts
  CIRCULAR = 'circular',             // For showing relationships
  MANUAL = 'manual'                  // User-controlled placement
}

interface LayoutEngine {
  apply(elements: Element[], algorithm: LayoutAlgorithm): Layout;
  optimize(layout: Layout): Layout;
  constraints: {
    addAlignment(elements: Element[]): void;
    addSpacing(min: number, max: number): void;
    addGrouping(groups: ElementGroup[]): void;
  };
}
```

### 2. Auto-Layout Features
- Minimize edge crossings
- Optimize space usage
- Maintain readability
- Respect trust boundaries
- Preserve user adjustments

## Template Library

### 1. Built-in Templates
```yaml
templates:
  - category: "Web Applications"
    templates:
      - name: "Three-tier Web App"
        description: "Standard web app with frontend, backend, database"
        elements: 15
        methodology: "STRIDE"
        
      - name: "Microservices Architecture"
        description: "Distributed microservices with API gateway"
        elements: 25
        methodology: "STRIDE"
        
      - name: "SPA with API"
        description: "Single-page application with REST API"
        elements: 12
        methodology: "STRIDE"
        
  - category: "Mobile Applications"
    templates:
      - name: "Mobile App with Backend"
        description: "Native mobile app with cloud backend"
        elements: 18
        methodology: "STRIDE"
        
  - category: "Cloud Native"
    templates:
      - name: "Kubernetes Deployment"
        description: "Containerized app in Kubernetes"
        elements: 20
        methodology: "STRIDE"
        
  - category: "Privacy Focused"
    templates:
      - name: "GDPR Compliant System"
        description: "System handling personal data"
        elements: 16
        methodology: "LINDDUN"
```

### 2. Custom Template Support
```javascript
interface Template {
  metadata: {
    name: string;
    author: string;
    version: string;
    methodology: string[];
    tags: string[];
  };
  
  elements: Element[];
  connections: Connection[];
  boundaries: TrustBoundary[];
  
  // Parameterization
  parameters: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    default: any;
    options?: any[];
  }[];
  
  // Dynamic generation
  generate(params: Map<string, any>): Diagram;
}
```

## Symbol Library

### 1. Standard Symbols
- **DFD Symbols**: Process, Data Store, External Entity, Data Flow
- **Cloud Provider Icons**: AWS, Azure, GCP service icons
- **Security Icons**: Firewall, encryption, authentication
- **Technology Icons**: Databases, frameworks, languages
- **Threat Icons**: STRIDE categories, LINDDUN categories

### 2. Custom Symbol Support
```typescript
interface Symbol {
  id: string;
  name: string;
  category: string;
  svg: string;
  properties: PropertyDefinition[];
  connectionPoints: Point[];
  
  // Behavior
  onConnect?: (from: Element, to: Element) => void;
  validate?: (element: Element) => ValidationResult;
  threatsTemplate?: ThreatTemplate[];
}

// Symbol registration
symbolLibrary.register({
  id: 'custom-database',
  name: 'Encrypted Database',
  category: 'Data Stores',
  svg: '<svg>...</svg>',
  properties: [
    {name: 'encryption', type: 'select', options: ['AES-256', 'AES-128']},
    {name: 'backup', type: 'boolean', default: true}
  ]
});
```

## Export Engine

### 1. Export Formats
```typescript
interface ExportOptions {
  format: 'png' | 'svg' | 'pdf' | 'visio' | 'drawio' | 'json';
  resolution?: number;        // For raster formats
  includeMetadata?: boolean;  // Embed diagram data
  includeThreats?: boolean;   // Overlay threats
  watermark?: string;         // Add watermark
}

class ExportEngine {
  async export(diagram: Diagram, options: ExportOptions): Promise<Blob> {
    switch(options.format) {
      case 'png':
        return this.exportPNG(diagram, options);
      case 'svg':
        return this.exportSVG(diagram, options);
      case 'pdf':
        return this.exportPDF(diagram, options);
      case 'visio':
        return this.exportVisio(diagram, options);
      case 'drawio':
        return this.exportDrawIO(diagram, options);
      case 'json':
        return this.exportJSON(diagram, options);
    }
  }
}
```

### 2. Import Capabilities
- Import from Visio (.vsdx)
- Import from draw.io (.drawio)
- Import from Lucidchart
- Import from PNG with embedded metadata
- Import from TMAC definitions

## Integration Points

### 1. With TMAC Service
```javascript
// Generate diagram from TMAC
const tmacModel = await tmacService.parse('model.yaml');
const diagram = await diagramService.generateFromTMAC(tmacModel, {
  diagramType: 'DFD',
  autoLayout: true,
  includeThreatOverlay: true
});

// Export diagram to TMAC
const tmacDefinition = await diagramService.exportToTMAC(diagramId, {
  format: 'yaml',
  includePositions: false
});
```

### 2. With Threat Engine
```javascript
// Overlay threats on diagram
const threats = await threatEngine.identifyThreats(diagram);
await diagramService.overlayThreats(diagramId, threats, {
  style: 'icons',  // or 'labels', 'heatmap'
  groupBy: 'stride-category'
});

// Validate diagram for threat modeling
const validation = await threatEngine.validateDiagram(diagram);
await diagramService.highlightIssues(diagramId, validation.issues);
```

### 3. With AI Service
```javascript
// AI-assisted diagram creation
const suggestions = await aiService.suggestElements(diagram);
await diagramService.showSuggestions(diagramId, suggestions);

// Auto-complete diagram
const completed = await aiService.completeDigram(diagram);
await diagramService.applyCompletion(diagramId, completed);
```

## Database Schema

```sql
-- Diagrams table
CREATE TABLE diagrams (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- DFD, AttackTree, Architecture, etc.
    project_id UUID REFERENCES projects(id),
    content JSONB NOT NULL,     -- Diagram definition
    thumbnail TEXT,             -- Base64 encoded preview
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMP
);

-- Diagram elements for searching
CREATE TABLE diagram_elements (
    id UUID PRIMARY KEY,
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    element_id VARCHAR(255) NOT NULL,
    element_type VARCHAR(50) NOT NULL,
    element_name VARCHAR(255),
    properties JSONB,
    UNIQUE(diagram_id, element_id)
);

-- Diagram versions
CREATE TABLE diagram_versions (
    id UUID PRIMARY KEY,
    diagram_id UUID REFERENCES diagrams(id),
    version INTEGER NOT NULL,
    content JSONB NOT NULL,
    change_summary TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(diagram_id, version)
);

-- Diagram templates
CREATE TABLE diagram_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    parameters JSONB,
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Symbol library
CREATE TABLE symbols (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    svg_content TEXT NOT NULL,
    properties JSONB,
    is_custom BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

```yaml
paths:
  /api/v1/diagrams:
    get:
      summary: List diagrams
      parameters:
        - name: type
          in: query
          schema:
            type: string
            enum: [DFD, AttackTree, Architecture, Sequence]
            
    post:
      summary: Create new diagram
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DiagramCreate'
              
  /api/v1/diagrams/{id}:
    get:
      summary: Get diagram
    put:
      summary: Update diagram
    delete:
      summary: Delete diagram
      
  /api/v1/diagrams/{id}/export:
    post:
      summary: Export diagram
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                format:
                  type: string
                  enum: [png, svg, pdf, visio, drawio]
                  
  /api/v1/diagrams/{id}/collaborate:
    get:
      summary: Join collaboration session
      responses:
        '101':
          description: Switching to WebSocket
          
  /api/v1/templates:
    get:
      summary: List diagram templates
    post:
      summary: Create custom template
      
  /api/v1/symbols:
    get:
      summary: Get symbol library
    post:
      summary: Upload custom symbol
```

## Performance Optimization

### 1. Rendering Performance
- Virtual scrolling for large diagrams
- Level-of-detail rendering
- WebGL acceleration for 1000+ elements
- Progressive rendering
- Caching rendered elements

### 2. Collaboration Performance
- Operational Transform for conflict resolution
- Delta compression for changes
- Throttled cursor updates
- Lazy loading of diagram sections

## Security Considerations

### 1. Access Control
- Diagram-level permissions
- Element-level permissions for sensitive data
- Read-only sharing with watermarks
- Audit trail for all changes

### 2. Data Protection
- Encryption at rest for diagrams
- Secure WebSocket for collaboration
- Sanitization of imported content
- Prevention of XSS in custom symbols
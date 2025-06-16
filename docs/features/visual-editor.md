# Visual Threat Model Editor

The Visual Threat Model Editor is a comprehensive drag-and-drop interface for creating and editing threat models. It provides an intuitive way to build data flow diagrams (DFDs) and identify security threats using various methodologies.

## Overview

The editor consists of several key components:

1. **Component Palette** - Pre-defined threat modeling elements
2. **Canvas** - Interactive drawing area with drag-and-drop support
3. **Properties Panel** - Real-time element configuration
4. **Threat Panel** - Threat management and analysis
5. **Toolbar** - Common operations and view controls

## Getting Started

### Accessing the Editor

1. Navigate to the Threat Models page
2. Click "Edit Model" on any existing threat model
3. Or select "Edit in Visual Editor" from the context menu

### Basic Operations

#### Adding Components
1. Drag any component from the Component Palette
2. Drop it onto the Canvas
3. The component will be created at the drop location

#### Creating Connections
1. Hold **Shift** and drag from one component to another
2. A connection will be created between the components
3. Connection properties can be edited in the Properties Panel

#### Selecting Elements
- Click on any component or connection to select it
- Selected elements are highlighted with a blue border
- Properties Panel will show the selected element's details

#### Moving Components
- Click and drag any component to reposition it
- Connections will automatically adjust

## Component Palette

### Actors
- **User** - Human user or external entity
- **Administrator** - System administrator with elevated privileges
- **Threat Actor** - Potential attacker or malicious entity

### Systems
- **Process** - Application process or service
- **Web Server** - Web server or application server
- **API** - REST API or web service
- **Mobile App** - Mobile application

### Data Stores
- **Database** - Relational or NoSQL database
- **Cache** - In-memory cache like Redis
- **File Storage** - File system or object storage

### Infrastructure
- **Firewall** - Network firewall or security appliance
- **Load Balancer** - Load balancer or reverse proxy
- **External System** - Third-party service or external system

## Canvas Features

### Navigation
- **Pan** - Click and drag on empty space to pan the view
- **Zoom** - Use zoom controls in the toolbar or mouse wheel
- **Grid** - Toggle grid display for alignment assistance
- **Fit to Screen** - Automatically fit all components in view

### Visual Feedback
- **Selection Highlight** - Selected elements show blue border
- **Connection Points** - Visible when element is selected
- **Hover Effects** - Visual feedback when hovering over elements

### Context Menu
Right-click on any element to access:
- Copy/Paste operations
- Delete element
- Element-specific actions

## Properties Panel

The Properties Panel provides detailed configuration for selected elements and consists of three tabs:

### General Tab
- **Name** - Element display name
- **Trust Boundary** - Security boundary assignment
- **Description** - Detailed element description
- **Technologies** - Technology stack information (for systems)
- **Protocol** - Communication protocol (for connections)
- **Data Classification** - Sensitivity level (for connections)

### Security Tab
- **Authentication** - Authentication method
- **Encryption** - Encryption details
- **Security Controls** - Applied security measures
- **Compliance Requirements** - Regulatory requirements
- **Rate Limiting** - API rate limiting (for connections)

### Threats Tab
- **Add Threats** - Create new threats for the element
- **Threat List** - View all associated threats
- **Severity Indicators** - Visual severity representation
- **Mitigation Tracking** - Track implemented mitigations

## Threat Panel

### Overview Dashboard
- **Total Threats** - Complete count
- **Critical/High** - High-priority threat counts
- **Mitigated** - Successfully addressed threats

### Search and Filter
- **Text Search** - Search threat names and descriptions
- **Category Filter** - Filter by STRIDE categories or methodology
- **Severity Filter** - Filter by threat severity levels

### Threat Categories
Threats are organized by methodology-specific categories:
- **STRIDE**: Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege
- **PASTA**: Business objectives, technical scope, threat analysis
- **LINDDUN**: Privacy-focused categories

### Threat Management
- **Edit Threats** - Modify threat details inline
- **Severity Assignment** - Visual severity indicators
- **Element Navigation** - Click to navigate to affected elements
- **Mitigation Tracking** - Track implementation status

## Toolbar Features

### File Operations
- **Save** - Save current threat model
- **Undo/Redo** - Action history (planned)

### View Controls
- **Zoom In/Out** - Adjust canvas zoom level
- **Fit to Screen** - Auto-fit all elements
- **Grid Toggle** - Show/hide alignment grid

### Element Operations
- **Delete** - Remove selected element
- **Copy/Paste** - Duplicate elements (planned)

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Select All | Ctrl+A |
| Copy | Ctrl+C |
| Paste | Ctrl+V |
| Delete | Delete |
| Undo | Ctrl+Z |
| Redo | Ctrl+Y |
| Zoom In | Ctrl++ |
| Zoom Out | Ctrl+- |
| Fit to Screen | Ctrl+0 |

## Data Flow Diagram Best Practices

### Element Placement
1. **Actors** - Place at diagram edges
2. **Processes** - Central positioning
3. **Data Stores** - Group related stores
4. **Trust Boundaries** - Clearly define security zones

### Connection Guidelines
1. **Data Flows** - Show direction with arrows
2. **Protocols** - Specify communication protocols
3. **Encryption** - Document encryption methods
4. **Authentication** - Define authentication mechanisms

### Threat Identification
1. **STRIDE Analysis** - Apply STRIDE to each element
2. **Trust Boundaries** - Focus on boundary crossings
3. **Data Sensitivity** - Consider data classification
4. **Attack Vectors** - Identify potential attack paths

## Technical Implementation

### Architecture
- **React Components** - Modular component structure
- **Canvas API** - Custom rendering engine
- **Redux State** - Centralized state management
- **TypeScript** - Type-safe implementation

### Performance
- **Efficient Rendering** - Only redraw on changes
- **Memory Management** - Proper cleanup and disposal
- **Scalability** - Handles large diagrams efficiently

### Browser Support
- Modern browsers with Canvas API support
- Chrome 70+, Firefox 65+, Safari 12+, Edge 79+

## Integration

### Data Persistence
- Automatic saving to backend API
- Real-time synchronization
- Version control integration (planned)

### Export Options
- PNG/SVG image export
- PDF report generation
- JSON data export
- Integration with external tools

## Troubleshooting

### Common Issues
1. **Components not dragging** - Ensure canvas is properly loaded
2. **Connections not creating** - Hold Shift while dragging
3. **Properties not updating** - Check element selection
4. **Performance issues** - Try reducing zoom level

### Browser Compatibility
- Disable browser extensions that modify canvas
- Clear browser cache if rendering issues occur
- Ensure JavaScript is enabled

## Future Enhancements

### Planned Features
1. **Real-time Collaboration** - Multi-user editing
2. **Advanced Shapes** - Custom component shapes
3. **Animation** - Smooth transitions and animations
4. **Templates** - Pre-built diagram templates
5. **Auto-layout** - Automatic diagram organization
6. **Version History** - Diagram versioning and rollback

### Integration Roadmap
1. **External Tools** - Jira, GitHub, Azure DevOps
2. **CI/CD Pipelines** - Automated threat analysis
3. **Compliance Frameworks** - Built-in compliance mapping
4. **AI Enhancement** - Intelligent threat suggestions
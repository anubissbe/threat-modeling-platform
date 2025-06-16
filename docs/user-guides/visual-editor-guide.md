# Visual Editor User Guide

This guide provides step-by-step instructions for using the Visual Threat Model Editor to create comprehensive threat models.

## Quick Start Tutorial

### Creating Your First Threat Model

1. **Navigate to Threat Models**
   - Go to the Threat Models page
   - Find an existing threat model or create a new one
   - Click "Edit Model" to open the visual editor

2. **Understanding the Interface**
   - **Left Panel**: Component Palette with drag-and-drop elements
   - **Center**: Canvas for drawing your threat model
   - **Right Panel**: Properties and threat management (appears when element is selected)
   - **Top Toolbar**: Save, zoom, and view controls

3. **Adding Your First Component**
   - Drag a "User" component from the Actors section
   - Drop it on the left side of the canvas
   - Click on it to see its properties in the right panel

4. **Adding a System**
   - Drag a "Web Server" from the Systems section
   - Drop it in the center of the canvas
   - Update its name to "Login Service"

5. **Creating a Connection**
   - Hold **Shift** and drag from the User to the Web Server
   - A connection arrow will appear
   - Click the connection to configure its properties

## Building a Complete Threat Model

### Step 1: Define the Architecture

#### Add Core Components
1. **External Actors**
   - Add User components for different user types
   - Add External System components for third-party services

2. **Internal Systems**
   - Add Process components for application services
   - Add Database components for data storage
   - Add API components for service interfaces

3. **Infrastructure**
   - Add Firewall components at network boundaries
   - Add Load Balancer components for traffic distribution

#### Example Architecture
```
[User] → [Firewall] → [Load Balancer] → [Web Server] → [API] → [Database]
                                          ↓
                                    [Cache System]
```

### Step 2: Configure Component Properties

#### For Each Component
1. **Select the component** by clicking on it
2. **General Tab**:
   - Set a descriptive name
   - Assign to appropriate trust boundary
   - Add detailed description
   - Specify technologies used

3. **Security Tab**:
   - Configure authentication method
   - Set security controls
   - Add compliance requirements

#### Trust Boundaries
Organize components into trust zones:
- **Internet**: External users and systems
- **DMZ**: Public-facing services
- **Internal Network**: Internal applications
- **Secure Zone**: Sensitive data and systems

### Step 3: Define Data Flows

#### Creating Meaningful Connections
1. **Hold Shift** and drag between components
2. **Configure each connection**:
   - Set descriptive name (e.g., "User Login Request")
   - Specify protocol (HTTPS, TCP, etc.)
   - Set data classification level
   - Define data types being transmitted

#### Connection Best Practices
- **Bi-directional flows**: Create separate connections for request/response
- **Data classification**: Match connection sensitivity to data being transmitted
- **Protocol specification**: Always specify the communication protocol
- **Authentication details**: Document how connections are authenticated

### Step 4: Identify Threats

#### Using the Threat Panel
1. **Open the Threat Panel** by clicking the threats button (bottom right)
2. **Review suggested threats** based on your architecture
3. **Add custom threats** specific to your application

#### Per-Component Threat Analysis
1. **Select each component**
2. **Go to Threats tab** in Properties Panel
3. **Add threats** using the input field
4. **Configure threat details**:
   - Set severity level
   - Assign likelihood
   - Add detailed description
   - Link to affected elements

#### STRIDE Methodology
Apply STRIDE analysis to each component:

**S - Spoofing**
- Can an attacker impersonate this component?
- Are authentication mechanisms sufficient?

**T - Tampering**
- Can data or code be modified without authorization?
- Are integrity checks in place?

**R - Repudiation**
- Can actions be denied or disputed?
- Is audit logging sufficient?

**I - Information Disclosure**
- Can sensitive information be exposed?
- Are access controls adequate?

**D - Denial of Service**
- Can the component be made unavailable?
- Are rate limiting and monitoring in place?

**E - Elevation of Privilege**
- Can an attacker gain higher privileges?
- Is the principle of least privilege applied?

## Advanced Features

### Threat Management

#### Organizing Threats
1. **Use Categories**: Group threats by STRIDE or custom categories
2. **Set Priorities**: Use severity levels to prioritize remediation
3. **Track Status**: Monitor threat mitigation progress

#### Mitigation Planning
1. **Select a threat** in the Threat Panel
2. **Add mitigations** with:
   - Implementation description
   - Effectiveness rating
   - Cost estimate
   - Implementation effort
   - Assigned team member

### Visual Design Tips

#### Layout Best Practices
1. **Left to Right Flow**: Place actors on left, systems in center, data stores on right
2. **Trust Boundaries**: Use visual grouping to show security zones
3. **Minimize Crossings**: Reduce connection line crossings for clarity
4. **Consistent Spacing**: Use grid for alignment

#### Component Naming
- Use descriptive, business-friendly names
- Avoid technical jargon when possible
- Be consistent with naming conventions
- Include version numbers for APIs

### Collaboration Features

#### Sharing Your Work
1. **Save Frequently**: Use Ctrl+S or toolbar save button
2. **Export Options**: Generate reports and diagrams
3. **Share Access**: Invite team members to collaborate

#### Review Process
1. **Status Tracking**: Use threat model status indicators
2. **Comments**: Add notes for reviewers
3. **Approval Workflow**: Track review and approval status

## Troubleshooting

### Common Issues

#### Canvas Problems
**Issue**: Components won't drag onto canvas
**Solution**: Ensure canvas is fully loaded, try refreshing the page

**Issue**: Connections aren't creating
**Solution**: Hold Shift key while dragging between components

**Issue**: Properties panel not updating
**Solution**: Make sure component is properly selected (blue border visible)

#### Performance Issues
**Issue**: Editor running slowly
**Solution**: 
- Reduce zoom level
- Close other browser tabs
- Check if diagram has too many elements (>50 components)

#### Browser Compatibility
**Issue**: Editor not loading
**Solution**:
- Use a modern browser (Chrome 70+, Firefox 65+)
- Disable browser extensions
- Clear browser cache

### Getting Help

#### Documentation
- Check the [Visual Editor Documentation](./visual-editor.md)
- Review [API Documentation](../api/core-service-api.md)
- See [Troubleshooting Guide](../troubleshooting.md)

#### Support Channels
- GitHub Issues: Report bugs and feature requests
- Community Forum: Ask questions and share tips
- Documentation Wiki: Contribute to documentation

## Tips and Best Practices

### Modeling Methodology

#### Start Simple
1. Begin with high-level components
2. Add detail incrementally
3. Focus on critical data flows first
4. Identify major trust boundaries

#### Iterate and Refine
1. Review with stakeholders
2. Update based on feedback
3. Add threats as you discover them
4. Keep diagrams current with code changes

### Security Focus

#### Key Questions to Ask
- What data is most valuable to attackers?
- Where are the trust boundaries?
- What happens if this component fails?
- How would an attacker approach this system?

#### Threat Prioritization
1. **Critical**: Immediate security risk
2. **High**: Significant business impact
3. **Medium**: Moderate risk with workarounds
4. **Low**: Minor issues with limited impact

### Team Collaboration

#### Roles and Responsibilities
- **Security Architect**: Overall threat model design
- **Developer**: Technical implementation details
- **Business Analyst**: Business context and requirements
- **Security Reviewer**: Threat validation and assessment

#### Review Process
1. **Initial Draft**: Complete basic architecture
2. **Technical Review**: Validate technical accuracy
3. **Security Review**: Assess threat coverage
4. **Business Review**: Ensure business alignment
5. **Final Approval**: Sign-off from stakeholders

### Maintenance

#### Keep It Current
- Update diagrams when architecture changes
- Review threats quarterly
- Add new threats as they're discovered
- Archive outdated threat models

#### Version Control
- Use descriptive save messages
- Track major changes
- Maintain change log
- Back up important models

## Next Steps

After completing your threat model:

1. **Generate Reports**: Export threat model documentation
2. **Share with Team**: Distribute to stakeholders
3. **Implement Mitigations**: Begin addressing identified threats
4. **Monitor Progress**: Track mitigation implementation
5. **Schedule Reviews**: Plan regular threat model updates
6. **Integrate with Development**: Include in CI/CD pipeline
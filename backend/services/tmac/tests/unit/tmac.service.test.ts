import { TMACParser, TMACValidator, TMACAnalyzer } from '../../src/tmac-core-inline';

describe('TMAC Core Services', () => {
  describe('TMACParser', () => {
    const validYAML = `
version: "1.0.0"
metadata:
  name: "Test Model"
  author: "Test User"
system:
  name: "Test System"
  components:
    - id: "comp1"
      name: "Component 1"
      type: "service"
dataFlows: []
threats:
  - id: "T1"
    name: "Test Threat"
    components: ["comp1"]
    category: "spoofing"
    severity: "medium"
mitigations:
  - id: "M1"
    name: "Test Mitigation"
    threats: ["T1"]
`;

    const validJSON = {
      version: "1.0.0",
      metadata: {
        name: "Test Model",
        author: "Test User"
      },
      system: {
        name: "Test System",
        components: [
          {
            id: "comp1",
            name: "Component 1",
            type: "service"
          }
        ]
      },
      dataFlows: [],
      threats: [
        {
          id: "T1",
          name: "Test Threat",
          components: ["comp1"],
          category: "spoofing",
          severity: "medium"
        }
      ],
      mitigations: [
        {
          id: "M1",
          name: "Test Mitigation",
          threats: ["T1"]
        }
      ]
    };

    describe('parse', () => {
      it('should parse valid YAML content', () => {
        const result = TMACParser.parse(validYAML, 'yaml');
        
        expect(result.version).toBe('1.0.0');
        expect(result.metadata.name).toBe('Test Model');
        expect(result.system.components).toHaveLength(1);
        expect(result.threats).toHaveLength(1);
        expect(result.mitigations).toHaveLength(1);
      });

      it('should parse valid JSON content', () => {
        const jsonString = JSON.stringify(validJSON);
        const result = TMACParser.parse(jsonString, 'json');
        
        expect(result.version).toBe('1.0.0');
        expect(result.metadata.name).toBe('Test Model');
        expect(result.system.components).toHaveLength(1);
        expect(result.threats).toHaveLength(1);
        expect(result.mitigations).toHaveLength(1);
      });

      it('should throw error for invalid YAML', () => {
        const invalidYAML = 'invalid: yaml\nmissing: required fields';
        
        expect(() => TMACParser.parse(invalidYAML, 'yaml')).toThrow('version is required');
      });

      it('should throw error for invalid JSON', () => {
        const invalidJSON = '{"invalid": "json", "missing": "required"}';
        
        expect(() => TMACParser.parse(invalidJSON, 'json')).toThrow('version is required');
      });

      it('should throw error for malformed YAML', () => {
        const malformedYAML = 'invalid: yaml\n  - malformed: structure';
        
        expect(() => TMACParser.parse(malformedYAML, 'yaml')).toThrow();
      });

      it('should throw error for malformed JSON', () => {
        const malformedJSON = '{"invalid": json}';
        
        expect(() => TMACParser.parse(malformedJSON, 'json')).toThrow();
      });
    });

    describe('stringify', () => {
      it('should convert model to YAML string', () => {
        const yamlString = TMACParser.stringify(validJSON, 'yaml');
        
        expect(yamlString).toContain('version: 1.0.0');
        expect(yamlString).toContain('name: Test Model');
        expect(yamlString).toContain('- id: comp1');
      });

      it('should convert model to JSON string', () => {
        const jsonString = TMACParser.stringify(validJSON, 'json');
        const parsed = JSON.parse(jsonString);
        
        expect(parsed.version).toBe('1.0.0');
        expect(parsed.metadata.name).toBe('Test Model');
        expect(parsed.system.components).toHaveLength(1);
      });

      it('should format JSON with proper indentation', () => {
        const jsonString = TMACParser.stringify(validJSON, 'json');
        
        expect(jsonString).toContain('  "version"');
        expect(jsonString).toContain('    "name"');
      });
    });

    describe('merge', () => {
      const model1 = {
        version: "1.0.0",
        metadata: { name: "Model 1" },
        system: {
          name: "System 1",
          components: [{ id: "comp1", name: "Component 1", type: "service" }]
        },
        dataFlows: [],
        threats: [{ id: "T1", name: "Threat 1", components: ["comp1"], category: "spoofing", severity: "low" }],
        mitigations: []
      };

      const model2 = {
        version: "1.0.0",
        metadata: { name: "Model 2" },
        system: {
          name: "System 2",
          components: [{ id: "comp2", name: "Component 2", type: "database" }]
        },
        dataFlows: [],
        threats: [{ id: "T2", name: "Threat 2", components: ["comp2"], category: "tampering", severity: "high" }],
        mitigations: []
      };

      it('should merge two models successfully', () => {
        const merged = TMACParser.merge([model1, model2], 'Merged Model');
        
        expect(merged.metadata.name).toBe('Merged Model');
        expect(merged.system.components).toHaveLength(2);
        expect(merged.threats).toHaveLength(2);
        expect(merged.system.components[0].id).toBe('comp1');
        expect(merged.system.components[1].id).toBe('comp2');
      });

      it('should handle empty models array', () => {
        const merged = TMACParser.merge([], 'Empty Model');
        
        expect(merged.metadata.name).toBe('Empty Model');
        expect(merged.system.components).toHaveLength(0);
        expect(merged.threats).toHaveLength(0);
        expect(merged.dataFlows).toHaveLength(0);
        expect(merged.mitigations).toHaveLength(0);
      });

      it('should merge single model', () => {
        const merged = TMACParser.merge([model1], 'Single Model');
        
        expect(merged.metadata.name).toBe('Single Model');
        expect(merged.system.components).toHaveLength(1);
        expect(merged.threats).toHaveLength(1);
      });
    });
  });

  describe('TMACValidator', () => {
    const validModel = {
      version: "1.0.0",
      metadata: {
        name: "Valid Model",
        author: "Test User"
      },
      system: {
        name: "Test System",
        components: [
          {
            id: "comp1",
            name: "Component 1",
            type: "service"
          }
        ]
      },
      dataFlows: [],
      threats: [
        {
          id: "T1",
          name: "Test Threat",
          components: ["comp1"],
          category: "spoofing",
          severity: "medium"
        }
      ],
      mitigations: []
    };

    describe('validate', () => {
      it('should validate correct model', () => {
        const result = TMACValidator.validate(validModel);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing required fields', () => {
        const invalidModel = { ...validModel };
        delete (invalidModel as any).version;
        
        const result = TMACValidator.validate(invalidModel);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('version is required');
      });

      it('should detect invalid threat categories', () => {
        const invalidModel = {
          ...validModel,
          threats: [
            {
              ...validModel.threats[0],
              category: 'invalid-category'
            }
          ]
        };
        
        const result = TMACValidator.validate(invalidModel);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.includes('category'))).toBe(true);
      });

      it('should detect invalid severity levels', () => {
        const invalidModel = {
          ...validModel,
          threats: [
            {
              ...validModel.threats[0],
              severity: 'invalid-severity'
            }
          ]
        };
        
        const result = TMACValidator.validate(invalidModel);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.includes('severity'))).toBe(true);
      });

      it('should validate component references in threats', () => {
        const invalidModel = {
          ...validModel,
          threats: [
            {
              ...validModel.threats[0],
              components: ['non-existent-component']
            }
          ]
        };
        
        const result = TMACValidator.validate(invalidModel);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.includes('non-existent-component'))).toBe(true);
      });

      it('should validate threat references in mitigations', () => {
        const invalidModel = {
          ...validModel,
          mitigations: [
            {
              id: 'M1',
              name: 'Test Mitigation',
              threats: ['non-existent-threat']
            }
          ]
        };
        
        const result = TMACValidator.validate(invalidModel);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.includes('non-existent-threat'))).toBe(true);
      });

      it('should provide warnings for missing optional fields', () => {
        const modelWithoutOptional = {
          version: "1.0.0",
          metadata: { name: "Minimal Model" },
          system: {
            name: "Test System",
            components: [{ id: "comp1", name: "Component 1", type: "service" }]
          },
          dataFlows: [],
          threats: [],
          mitigations: []
        };
        
        const result = TMACValidator.validate(modelWithoutOptional);
        
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });

    describe('validateComponent', () => {
      it('should validate correct component', () => {
        const component = {
          id: 'comp1',
          name: 'Test Component',
          type: 'service'
        };
        
        const errors = TMACValidator.validateComponent(component);
        expect(errors).toHaveLength(0);
      });

      it('should detect missing component fields', () => {
        const component = {
          id: 'comp1',
          name: 'Test Component'
          // missing type
        };
        
        const errors = TMACValidator.validateComponent(component);
        expect(errors).toContain('Component comp1: type is required');
      });

      it('should validate component type', () => {
        const component = {
          id: 'comp1',
          name: 'Test Component',
          type: 'invalid-type'
        };
        
        const errors = TMACValidator.validateComponent(component);
        expect(errors.some(error => error.includes('invalid component type'))).toBe(true);
      });
    });

    describe('validateThreat', () => {
      it('should validate correct threat', () => {
        const threat = {
          id: 'T1',
          name: 'Test Threat',
          components: ['comp1'],
          category: 'spoofing',
          severity: 'medium'
        };
        
        const errors = TMACValidator.validateThreat(threat, ['comp1']);
        expect(errors).toHaveLength(0);
      });

      it('should detect missing threat fields', () => {
        const threat = {
          id: 'T1',
          name: 'Test Threat'
          // missing components, category, severity
        };
        
        const errors = TMACValidator.validateThreat(threat, ['comp1']);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors).toContain('Threat T1: components is required');
      });

      it('should validate threat category', () => {
        const threat = {
          id: 'T1',
          name: 'Test Threat',
          components: ['comp1'],
          category: 'invalid-category',
          severity: 'medium'
        };
        
        const errors = TMACValidator.validateThreat(threat, ['comp1']);
        expect(errors.some(error => error.includes('invalid category'))).toBe(true);
      });
    });
  });

  describe('TMACAnalyzer', () => {
    const sampleModel = {
      version: "1.0.0",
      metadata: { name: "Analysis Test Model" },
      system: {
        name: "Test System",
        components: [
          { id: "comp1", name: "Component 1", type: "service" },
          { id: "comp2", name: "Component 2", type: "database" }
        ]
      },
      dataFlows: [
        {
          id: "df1",
          name: "Data Flow 1",
          source: "comp1",
          destination: "comp2",
          protocol: "HTTPS"
        }
      ],
      threats: [
        {
          id: "T1",
          name: "High Severity Threat",
          components: ["comp1"],
          category: "spoofing",
          severity: "high"
        },
        {
          id: "T2",
          name: "Critical Threat",
          components: ["comp2"],
          category: "tampering",
          severity: "critical"
        },
        {
          id: "T3",
          name: "Medium Threat",
          components: ["comp1", "comp2"],
          category: "information_disclosure",
          severity: "medium"
        }
      ],
      mitigations: [
        {
          id: "M1",
          name: "Mitigation 1",
          threats: ["T1", "T2"]
        }
      ]
    };

    describe('analyze', () => {
      it('should perform comprehensive analysis', () => {
        const result = TMACAnalyzer.analyze(sampleModel);
        
        expect(result.summary.totalComponents).toBe(2);
        expect(result.summary.totalThreats).toBe(3);
        expect(result.summary.criticalThreats).toBe(1);
        expect(result.summary.highThreats).toBe(1);
        expect(result.summary.unmitigatedThreats).toBe(1); // T3 is not mitigated
        expect(result.summary.coveragePercentage).toBe(67); // 2 out of 3 threats mitigated
        expect(result.summary.riskScore).toBeGreaterThan(0);
      });

      it('should calculate correct risk score', () => {
        const result = TMACAnalyzer.analyze(sampleModel);
        
        // Risk score calculation: critical=25, high=15, unmitigated=10
        // Expected: 1*25 + 1*15 + 1*10 = 50
        expect(result.summary.riskScore).toBe(50);
      });

      it('should provide security findings', () => {
        const result = TMACAnalyzer.analyze(sampleModel);
        
        expect(result.findings).toBeDefined();
        expect(result.findings.length).toBeGreaterThan(0);
        expect(result.findings.some(f => f.severity === 'high')).toBe(true);
      });

      it('should provide recommendations', () => {
        const result = TMACAnalyzer.analyze(sampleModel);
        
        expect(result.recommendations).toBeDefined();
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations).toContain('Review and mitigate unaddressed threats');
      });

      it('should handle model with no threats', () => {
        const emptyModel = {
          ...sampleModel,
          threats: [],
          mitigations: []
        };
        
        const result = TMACAnalyzer.analyze(emptyModel);
        
        expect(result.summary.totalThreats).toBe(0);
        expect(result.summary.criticalThreats).toBe(0);
        expect(result.summary.coveragePercentage).toBe(0);
        expect(result.summary.riskScore).toBe(0);
      });

      it('should handle model with all threats mitigated', () => {
        const fullyMitigatedModel = {
          ...sampleModel,
          mitigations: [
            {
              id: "M1",
              name: "Complete Mitigation",
              threats: ["T1", "T2", "T3"]
            }
          ]
        };
        
        const result = TMACAnalyzer.analyze(fullyMitigatedModel);
        
        expect(result.summary.unmitigatedThreats).toBe(0);
        expect(result.summary.coveragePercentage).toBe(100);
      });
    });

    describe('calculateRiskScore', () => {
      it('should calculate risk score correctly', () => {
        const score = TMACAnalyzer.calculateRiskScore(
          1, // critical
          2, // high
          3, // unmitigated
          5  // total
        );
        
        // Expected: 1*25 + 2*15 + 3*10 = 85
        expect(score).toBe(85);
      });

      it('should cap risk score at 100', () => {
        const score = TMACAnalyzer.calculateRiskScore(
          10, // critical
          10, // high
          10, // unmitigated
          30  // total
        );
        
        expect(score).toBe(100);
      });

      it('should handle zero values', () => {
        const score = TMACAnalyzer.calculateRiskScore(0, 0, 0, 0);
        expect(score).toBe(0);
      });
    });

    describe('generateFindings', () => {
      it('should generate findings for critical threats', () => {
        const findings = TMACAnalyzer.generateFindings(sampleModel);
        
        const criticalFindings = findings.filter(f => f.severity === 'critical');
        expect(criticalFindings.length).toBeGreaterThan(0);
      });

      it('should generate findings for unmitigated threats', () => {
        const findings = TMACAnalyzer.generateFindings(sampleModel);
        
        const unmitigatedFindings = findings.filter(f => 
          f.description.includes('not mitigated')
        );
        expect(unmitigatedFindings.length).toBeGreaterThan(0);
      });

      it('should handle model with no threats', () => {
        const emptyModel = { ...sampleModel, threats: [], mitigations: [] };
        const findings = TMACAnalyzer.generateFindings(emptyModel);
        
        expect(findings).toHaveLength(0);
      });
    });

    describe('generateRecommendations', () => {
      it('should provide appropriate recommendations', () => {
        const recommendations = TMACAnalyzer.generateRecommendations(sampleModel);
        
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
        
        // Should include recommendation for unmitigated threats
        expect(recommendations.some(r => 
          r.includes('unaddressed threats')
        )).toBe(true);
      });

      it('should recommend security controls for critical threats', () => {
        const recommendations = TMACAnalyzer.generateRecommendations(sampleModel);
        
        expect(recommendations.some(r => 
          r.includes('security controls')
        )).toBe(true);
      });

      it('should handle fully secure model', () => {
        const secureModel = {
          ...sampleModel,
          threats: [
            {
              id: "T1",
              name: "Low Risk Threat",
              components: ["comp1"],
              category: "spoofing",
              severity: "low"
            }
          ],
          mitigations: [
            {
              id: "M1",
              name: "Complete Mitigation",
              threats: ["T1"]
            }
          ]
        };
        
        const recommendations = TMACAnalyzer.generateRecommendations(secureModel);
        
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      });
    });
  });
});
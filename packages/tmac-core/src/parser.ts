import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ThreatModel } from './types';

export class TMACParser {
  /**
   * Parse a TMAC file from string content
   */
  static parse(content: string, format: 'yaml' | 'json' = 'yaml'): ThreatModel {
    let data: any;
    
    try {
      if (format === 'yaml') {
        data = yaml.load(content);
      } else {
        data = JSON.parse(content);
      }
    } catch (error) {
      throw new Error(`Failed to parse ${format.toUpperCase()} content: ${error}`);
    }

    // Basic validation of required fields
    if (!data.version) throw new Error('version is required');
    if (!data.metadata) throw new Error('metadata is required');
    if (!data.system) throw new Error('system is required');
    if (!data.dataFlows) throw new Error('dataFlows is required');
    if (!data.threats) throw new Error('threats is required');

    return data as ThreatModel;
  }

  /**
   * Parse a TMAC file from file path
   */
  static async parseFile(filePath: string): Promise<ThreatModel> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    
    let format: 'yaml' | 'json' = 'yaml';
    if (ext === '.json') {
      format = 'json';
    } else if (!['.yaml', '.yml', '.tmac'].includes(ext)) {
      throw new Error(`Unsupported file extension: ${ext}`);
    }

    return this.parse(content, format);
  }

  /**
   * Parse multiple TMAC files and merge them
   */
  static async parseMultiple(filePaths: string[]): Promise<ThreatModel> {
    const models = await Promise.all(filePaths.map(fp => this.parseFile(fp)));
    return this.merge(models);
  }

  /**
   * Merge multiple threat models
   */
  static merge(models: ThreatModel[]): ThreatModel {
    if (models.length === 0) {
      throw new Error('No models to merge');
    }

    if (models.length === 1) {
      return models[0];
    }

    // Start with the first model as base
    const merged = JSON.parse(JSON.stringify(models[0])) as ThreatModel;

    // Merge remaining models
    for (let i = 1; i < models.length; i++) {
      const model = models[i];

      // Update metadata
      merged.metadata.updated = new Date().toISOString();
      if (model.metadata.tags) {
        merged.metadata.tags = [...new Set([...(merged.metadata.tags || []), ...model.metadata.tags])];
      }
      if (model.metadata.compliance) {
        merged.metadata.compliance = [...new Set([...(merged.metadata.compliance || []), ...model.metadata.compliance])];
      }

      // Merge components (by ID)
      const componentMap = new Map(merged.system.components.map(c => [c.id, c]));
      model.system.components.forEach(component => {
        if (!componentMap.has(component.id)) {
          merged.system.components.push(component);
        }
      });

      // Merge trust boundaries
      if (model.system.trustBoundaries) {
        const boundaryMap = new Map((merged.system.trustBoundaries || []).map(b => [b.id, b]));
        model.system.trustBoundaries.forEach(boundary => {
          if (!boundaryMap.has(boundary.id)) {
            merged.system.trustBoundaries = merged.system.trustBoundaries || [];
            merged.system.trustBoundaries.push(boundary);
          }
        });
      }

      // Merge data flows (by ID)
      const flowMap = new Map(merged.dataFlows.map(f => [f.id, f]));
      model.dataFlows.forEach(flow => {
        if (!flowMap.has(flow.id)) {
          merged.dataFlows.push(flow);
        }
      });

      // Merge threats (by ID)
      const threatMap = new Map(merged.threats.map(t => [t.id, t]));
      model.threats.forEach(threat => {
        if (!threatMap.has(threat.id)) {
          merged.threats.push(threat);
        }
      });

      // Merge mitigations (by ID)
      if (model.mitigations) {
        merged.mitigations = merged.mitigations || [];
        const mitigationMap = new Map(merged.mitigations.map(m => [m.id, m]));
        model.mitigations.forEach(mitigation => {
          if (!mitigationMap.has(mitigation.id)) {
            merged.mitigations!.push(mitigation);
          }
        });
      }

      // Merge assumptions and out of scope
      if (model.assumptions) {
        merged.assumptions = [...new Set([...(merged.assumptions || []), ...model.assumptions])];
      }
      if (model.outOfScope) {
        merged.outOfScope = [...new Set([...(merged.outOfScope || []), ...model.outOfScope])];
      }
    }

    return merged;
  }

  /**
   * Convert threat model to string
   */
  static stringify(model: ThreatModel, format: 'yaml' | 'json' = 'yaml'): string {
    if (format === 'yaml') {
      return yaml.dump(model, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false
      });
    } else {
      return JSON.stringify(model, null, 2);
    }
  }

  /**
   * Save threat model to file
   */
  static async saveToFile(model: ThreatModel, filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    let format: 'yaml' | 'json' = 'yaml';
    
    if (ext === '.json') {
      format = 'json';
    }

    const content = this.stringify(model, format);
    await fs.writeFile(filePath, content, 'utf-8');
  }
}
export type MethodologyType = 
  | 'STRIDE' 
  | 'PASTA' 
  | 'LINDDUN' 
  | 'VAST' 
  | 'DREAD' 
  | 'OCTAVE' 
  | 'TRIKE' 
  | 'CUSTOM';

export interface MethodologyConfig {
  id: string;
  name: string;
  type: MethodologyType;
  description: string;
  categories: string[];
  riskLevels: string[];
  customFields?: Record<string, unknown>;
}

export interface ThreatCategory {
  id: string;
  name: string;
  description: string;
  methodology: MethodologyType;
  examples: string[];
}
export interface ReportConfig {
  format: 'pdf' | 'html' | 'json' | 'xlsx';
  template?: string;
  includeCharts?: boolean;
  includeDiagrams?: boolean;
  includeThreats?: boolean;
  includeRisks?: boolean;
  includeRecommendations?: boolean;
  customSections?: ReportSection[];
  styling?: ReportStyling;
}

export interface ReportStyling {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  logoUrl?: string;
  headerText?: string;
  footerText?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
  type: 'text' | 'chart' | 'table' | 'diagram';
}

export interface CreateReportRequest {
  threatModelId: string;
  name: string;
  description?: string;
  config: ReportConfig;
  templateId?: string;
}

export interface UpdateReportRequest {
  name?: string;
  description?: string;
  config?: Partial<ReportConfig>;
  status?: ReportStatus;
}

export interface ReportData {
  id: string;
  threatModelId: string;
  name: string;
  description: string;
  config: ReportConfig;
  status: ReportStatus;
  filePath?: string;
  fileSize?: number | undefined;
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  config: ReportConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ThreatModelData {
  id: string;
  name: string;
  description: string;
  methodology: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  threats: ThreatData[];
  risks: RiskData[];
  diagrams: DiagramData[];
  project: ProjectData;
}

export interface ThreatData {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  likelihood: string;
  impact: string;
  riskScore: number;
  status: string;
  mitigation?: string;
  verification?: string;
}

export interface RiskData {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high' | 'critical';
  impact: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  mitigation: string;
  status: string;
}

export interface DiagramData {
  id: string;
  name: string;
  description: string;
  elements: any[];
  connections: any[];
  metadata: any;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  organization: string;
}

export interface ReportGenerationJob {
  id: string;
  reportId: string;
  status: ReportStatus;
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  threatModelId?: string;
  status?: ReportStatus;
}
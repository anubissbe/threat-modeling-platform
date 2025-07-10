export interface ProjectReport {
  id: string;
  projectId: string;
  projectName: string;
  reportType: ReportType;
  title: string;
  description?: string;
  generatedAt: Date;
  generatedBy: string;
  organizationId: string;
  metadata: ReportMetadata;
  content: ReportContent;
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
}

export type ReportType = 
  | 'vulnerability_summary'
  | 'threat_analysis'
  | 'risk_assessment'
  | 'compliance_audit'
  | 'security_posture'
  | 'executive_summary'
  | 'technical_deep_dive'
  | 'trend_analysis'
  | 'comparison_report';

export interface ReportMetadata {
  format: 'pdf' | 'html' | 'json' | 'csv' | 'xlsx';
  includeCharts: boolean;
  includeSummary: boolean;
  includeRecommendations: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: {
    severity?: string[];
    status?: string[];
    assignees?: string[];
    components?: string[];
    tags?: string[];
  };
  customFields?: {
    [key: string]: any;
  };
}

export interface ReportContent {
  summary: ReportSummary;
  vulnerabilities?: VulnerabilityReportSection;
  threats?: ThreatReportSection;
  risks?: RiskReportSection;
  recommendations?: RecommendationSection;
  charts?: ChartData[];
  appendices?: AppendixSection[];
}

export interface ReportSummary {
  totalProjects: number;
  totalVulnerabilities: number;
  totalThreats: number;
  riskScore: number;
  complianceScore?: number;
  keyFindings: string[];
  executiveSummary: string;
  generationTime: number; // seconds
}

export interface VulnerabilityReportSection {
  total: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byStatus: {
    open: number;
    inProgress: number;
    resolved: number;
    falsePositive: number;
    wontFix: number;
  };
  trending: {
    newThisWeek: number;
    resolvedThisWeek: number;
    avgResolutionTime: number;
  };
  topVulnerabilities: Array<{
    id: string;
    title: string;
    severity: string;
    cvssScore?: number;
    component: string;
  }>;
}

export interface ThreatReportSection {
  total: number;
  byCategory: {
    [category: string]: number;
  };
  byLikelihood: {
    high: number;
    medium: number;
    low: number;
  };
  byImpact: {
    high: number;
    medium: number;
    low: number;
  };
  topThreats: Array<{
    id: string;
    title: string;
    category: string;
    likelihood: string;
    impact: string;
    riskScore: number;
  }>;
}

export interface RiskReportSection {
  overallRiskScore: number;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  riskTrends: Array<{
    date: string;
    score: number;
  }>;
  topRisks: Array<{
    id: string;
    description: string;
    likelihood: number;
    impact: number;
    riskScore: number;
    mitigation: string;
  }>;
}

export interface RecommendationSection {
  immediate: string[];
  shortTerm: string[];
  longTerm: string[];
  strategic: string[];
  priorityMatrix: Array<{
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
  }>;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap';
  title: string;
  description?: string;
  data: any;
  options?: any;
}

export interface AppendixSection {
  title: string;
  content: string;
  type: 'methodology' | 'glossary' | 'references' | 'raw_data' | 'technical_details';
}

export interface CreateReportRequest {
  reportType: ReportType;
  title: string;
  description?: string;
  metadata: ReportMetadata;
}

export interface ReportFilters {
  reportType?: ReportType;
  status?: 'generating' | 'completed' | 'failed';
  generatedBy?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  reportType: ReportType;
  description: string;
  defaultMetadata: ReportMetadata;
  sections: string[];
  isCustom: boolean;
  organizationId?: string;
}

export interface ReportStatistics {
  totalReports: number;
  reportsThisMonth: number;
  mostGeneratedType: ReportType;
  avgGenerationTime: number;
  byType: {
    [key in ReportType]?: number;
  };
  byStatus: {
    generating: number;
    completed: number;
    failed: number;
  };
}
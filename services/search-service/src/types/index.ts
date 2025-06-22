export interface SearchQuery {
  query?: string;
  filters?: SearchFilters;
  sort?: SearchSort[];
  pagination?: SearchPagination;
  aggregations?: string[];
  highlight?: boolean;
  suggest?: boolean;
}

export interface SearchFilters {
  contentType?: string[];
  userId?: string;
  projectId?: string;
  threatModelId?: string;
  severity?: string[];
  status?: string[];
  tags?: string[];
  dateRange?: {
    field: string;
    from?: string;
    to?: string;
  };
  numericRange?: {
    field: string;
    min?: number;
    max?: number;
  };
}

export interface SearchSort {
  field: string;
  order: 'asc' | 'desc';
}

export interface SearchPagination {
  page: number;
  size: number;
  from?: number;
}

export interface SearchResult<T = any> {
  hits: SearchHit<T>[];
  total: {
    value: number;
    relation: 'eq' | 'gte';
  };
  maxScore: number;
  aggregations?: SearchAggregations;
  suggestions?: SearchSuggestion[];
  took: number;
}

export interface SearchHit<T = any> {
  id: string;
  index: string;
  score: number;
  source: T;
  highlight?: Record<string, string[]>;
}

export interface SearchAggregations {
  [key: string]: {
    buckets?: Array<{
      key: string;
      docCount: number;
    }>;
    value?: number;
    values?: Record<string, number>;
  };
}

export interface SearchSuggestion {
  text: string;
  offset: number;
  length: number;
  options: Array<{
    text: string;
    score: number;
    freq?: number;
  }>;
}

// Content type interfaces
export interface ThreatContent {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  mitigation?: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  userId: string;
  projectId: string;
  threatModelId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContent {
  id: string;
  name: string;
  description: string;
  status: string;
  type: string;
  methodology: string[];
  userId: string;
  organizationId: string;
  teamMembers: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ThreatModelContent {
  id: string;
  name: string;
  description: string;
  version: string;
  status: string;
  methodology: string;
  projectId: string;
  userId: string;
  components: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
  }>;
  dataFlows: Array<{
    id: string;
    name: string;
    source: string;
    destination: string;
    description: string;
  }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserContent {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  department?: string;
  skills: string[];
  bio?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileContent {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  description?: string;
  userId: string;
  projectId?: string;
  threatModelId?: string;
  tags: string[];
  isPublic: boolean;
  extractedText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportContent {
  id: string;
  title: string;
  description: string;
  type: string;
  format: string;
  status: string;
  projectId: string;
  userId: string;
  summary: string;
  findings: Array<{
    category: string;
    severity: string;
    title: string;
    description: string;
  }>;
  recommendations: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Index configuration
export interface IndexConfig {
  name: string;
  mappings: Record<string, any>;
  settings: Record<string, any>;
  aliases?: string[];
}

export interface SearchIndexer {
  indexContent(id: string, content: any): Promise<void>;
  updateContent(id: string, content: any): Promise<void>;
  deleteContent(id: string): Promise<void>;
  bulkIndex(documents: Array<{ id: string; content: any }>): Promise<void>;
  reindex(): Promise<void>;
}

// Search analytics
export interface SearchAnalytics {
  query: string;
  userId?: string;
  filters?: SearchFilters;
  resultsCount: number;
  responseTime: number;
  clickedResults?: string[];
  timestamp: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
}

export interface PopularSearch {
  query: string;
  count: number;
  lastSearched: string;
}

export interface SearchMetrics {
  totalSearches: number;
  uniqueUsers: number;
  avgResponseTime: number;
  popularQueries: PopularSearch[];
  searchesPerDay: Array<{
    date: string;
    count: number;
  }>;
  noResultsQueries: string[];
  clickThroughRate: number;
}

// Auto-complete and suggestions
export interface AutoCompleteRequest {
  prefix: string;
  context?: {
    contentTypes?: string[];
    userId?: string;
    projectId?: string;
  };
  size?: number;
}

export interface AutoCompleteResponse {
  suggestions: Array<{
    text: string;
    score: number;
    type: 'query' | 'title' | 'tag' | 'user';
    metadata?: any;
  }>;
}

// Real-time indexing events
export interface IndexingEvent {
  type: 'create' | 'update' | 'delete';
  contentType: string;
  contentId: string;
  content?: any;
  userId?: string;
  timestamp: string;
}

// Search configuration
export interface SearchConfig {
  elasticsearch: {
    node: string;
    auth?: {
      username: string;
      password: string;
    };
    ssl?: {
      ca?: string;
      rejectUnauthorized?: boolean;
    };
  };
  indices: {
    prefix: string;
    replicas: number;
    shards: number;
  };
  search: {
    defaultSize: number;
    maxSize: number;
    highlightFragmentSize: number;
    suggestionSize: number;
  };
  analytics: {
    enabled: boolean;
    retentionDays: number;
  };
}

export type ContentType = 
  | 'threat'
  | 'project'
  | 'threat_model'
  | 'user'
  | 'file'
  | 'report';

export type SearchableContent = 
  | ThreatContent
  | ProjectContent
  | ThreatModelContent
  | UserContent
  | FileContent
  | ReportContent;
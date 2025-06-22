import axios from 'axios';
import { createHash } from 'crypto';
import { logger, mlLogger } from '../utils/logger';
import {
  ThreatIntelligence,
  ThreatIntelSource,
  PredictionRequest,
  PredictionResponse,
  Evidence,
} from '../types';
import { config } from '../config';

export class ThreatIntelligenceService {
  private intelligenceCache: Map<string, CachedIntelligence> = new Map();
  private threatDatabase: Map<string, ThreatIntelligence> = new Map();
  private cveDatabase: Map<string, CVEEntry> = new Map();
  private mitreAttackPatterns: Map<string, MitrePattern> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeLocalDatabase();
  }

  /**
   * Initialize threat intelligence service
   */
  async initialize(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Load local threat intelligence
      await this.loadLocalIntelligence();
      
      // Initialize external feed connections
      await this.initializeExternalFeeds();
      
      // Start periodic updates
      this.startPeriodicUpdates();
      
      mlLogger.modelLoaded('THREAT_INTELLIGENCE', '1.0.0', Date.now() - startTime);
      logger.info('Threat intelligence service initialized');
    } catch (error) {
      logger.error('Failed to initialize threat intelligence:', error);
      throw error;
    }
  }

  /**
   * Initialize local threat database
   */
  private initializeLocalDatabase(): void {
    // MITRE ATT&CK patterns
    this.mitreAttackPatterns.set('T1190', {
      id: 'T1190',
      name: 'Exploit Public-Facing Application',
      tactic: 'Initial Access',
      description: 'Adversaries may attempt to take advantage of a weakness in an Internet-facing computer',
      mitigations: ['M1050', 'M1030', 'M1016'],
      indicators: ['unusual traffic patterns', 'exploit attempts', 'scanning activity'],
    });

    this.mitreAttackPatterns.set('T1055', {
      id: 'T1055',
      name: 'Process Injection',
      tactic: 'Defense Evasion, Privilege Escalation',
      description: 'Process injection is a method of executing arbitrary code in a live process',
      mitigations: ['M1040', 'M1026'],
      indicators: ['process hollowing', 'dll injection', 'thread execution hijacking'],
    });

    this.mitreAttackPatterns.set('T1003', {
      id: 'T1003',
      name: 'OS Credential Dumping',
      tactic: 'Credential Access',
      description: 'Adversaries may attempt to dump credentials to obtain account login information',
      mitigations: ['M1015', 'M1017', 'M1027'],
      indicators: ['lsass access', 'sam database access', 'credential dumping tools'],
    });

    // Common CVE entries
    this.cveDatabase.set('CVE-2021-44228', {
      id: 'CVE-2021-44228',
      description: 'Log4j Remote Code Execution (Log4Shell)',
      severity: 'critical',
      cvss: 10.0,
      affectedSoftware: ['Apache Log4j 2.0-2.14.1'],
      mitigations: ['Update to Log4j 2.15.0 or later', 'Apply vendor patches'],
      exploitAvailable: true,
    });

    this.cveDatabase.set('CVE-2021-34527', {
      id: 'CVE-2021-34527',
      description: 'Windows Print Spooler RCE (PrintNightmare)',
      severity: 'critical',
      cvss: 8.8,
      affectedSoftware: ['Windows Server', 'Windows 10'],
      mitigations: ['Apply security updates', 'Disable Print Spooler service'],
      exploitAvailable: true,
    });

    // Initialize threat entries
    this.threatDatabase.set('ransomware-2024', {
      id: 'ransomware-2024',
      source: ThreatIntelSource.INTERNAL,
      type: 'Ransomware',
      severity: 'critical',
      description: 'New ransomware variants targeting critical infrastructure',
      indicators: [
        'file encryption patterns',
        'ransom note creation',
        'shadow copy deletion',
        'network reconnaissance',
      ],
      mitigations: [
        'Regular backups',
        'Network segmentation',
        'Endpoint detection and response',
        'User awareness training',
      ],
      references: ['https://example.com/ransomware-report'],
      lastUpdated: new Date(),
    });
  }

  /**
   * Load local intelligence data
   */
  private async loadLocalIntelligence(): Promise<void> {
    // In production, this would load from a database or file
    logger.info('Loaded local threat intelligence database');
  }

  /**
   * Initialize external threat feeds
   */
  private async initializeExternalFeeds(): Promise<void> {
    // Initialize connections to external sources
    // Note: In production, these would be real API calls
    
    if (config.MITRE_API_KEY) {
      logger.info('MITRE ATT&CK feed initialized');
    }
    
    if (config.NVD_API_KEY) {
      logger.info('NVD feed initialized');
    }
    
    if (config.VIRUSTOTAL_API_KEY) {
      logger.info('VirusTotal feed initialized');
    }
  }

  /**
   * Start periodic intelligence updates
   */
  private startPeriodicUpdates(): void {
    this.updateInterval = setInterval(
      () => this.updateThreatIntelligence(),
      config.MODEL_UPDATE_INTERVAL
    );
  }

  /**
   * Update threat intelligence from external sources
   */
  private async updateThreatIntelligence(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update from MITRE ATT&CK
      if (config.MITRE_API_KEY) {
        await this.updateFromMitre();
      }
      
      // Update from NVD
      if (config.NVD_API_KEY) {
        await this.updateFromNVD();
      }
      
      // Update from VirusTotal
      if (config.VIRUSTOTAL_API_KEY) {
        await this.updateFromVirusTotal();
      }
      
      const updateTime = Date.now() - startTime;
      mlLogger.threatIntelligenceUpdate('all', this.threatDatabase.size, updateTime);
      
    } catch (error) {
      logger.error('Failed to update threat intelligence:', error);
    }
  }

  /**
   * Update from MITRE ATT&CK
   */
  private async updateFromMitre(): Promise<void> {
    try {
      // Simulated MITRE API call
      const newPatterns = await this.fetchMitrePatterns();
      
      newPatterns.forEach(pattern => {
        this.mitreAttackPatterns.set(pattern.id, pattern);
      });
      
      logger.info(`Updated ${newPatterns.length} MITRE ATT&CK patterns`);
    } catch (error) {
      logger.error('MITRE update failed:', error);
    }
  }

  /**
   * Update from NVD
   */
  private async updateFromNVD(): Promise<void> {
    try {
      // Simulated NVD API call
      const newCVEs = await this.fetchNVDData();
      
      newCVEs.forEach(cve => {
        this.cveDatabase.set(cve.id, cve);
      });
      
      logger.info(`Updated ${newCVEs.length} CVE entries`);
    } catch (error) {
      logger.error('NVD update failed:', error);
    }
  }

  /**
   * Update from VirusTotal
   */
  private async updateFromVirusTotal(): Promise<void> {
    try {
      // Simulated VirusTotal API call
      const threats = await this.fetchVirusTotalData();
      
      threats.forEach(threat => {
        this.threatDatabase.set(threat.id, {
          ...threat,
          source: ThreatIntelSource.VIRUSTOTAL,
          lastUpdated: new Date(),
        });
      });
      
      logger.info(`Updated ${threats.length} VirusTotal threats`);
    } catch (error) {
      logger.error('VirusTotal update failed:', error);
    }
  }

  /**
   * Fetch MITRE patterns (simulated)
   */
  private async fetchMitrePatterns(): Promise<MitrePattern[]> {
    // In production, this would be a real API call
    return [];
  }

  /**
   * Fetch NVD data (simulated)
   */
  private async fetchNVDData(): Promise<CVEEntry[]> {
    // In production, this would be a real API call
    return [];
  }

  /**
   * Fetch VirusTotal data (simulated)
   */
  private async fetchVirusTotalData(): Promise<any[]> {
    // In production, this would be a real API call
    return [];
  }

  /**
   * Query threat intelligence
   */
  async queryIntelligence(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();

    try {
      const query = this.extractQuery(request.input);
      const relevantIntelligence = await this.searchIntelligence(query);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        modelType: 'THREAT_INTELLIGENCE' as any,
        predictions: relevantIntelligence.map(intel => ({
          label: intel.type,
          confidence: this.calculateRelevance(intel, query),
          explanation: this.generateIntelligenceExplanation(intel),
          evidence: this.intelligenceToEvidence(intel),
          relatedThreats: this.getRelatedThreats(intel),
          suggestedMitigations: intel.mitigations.map(m => ({
            id: m,
            title: m,
            description: '',
            category: 'Threat Intelligence',
            effectiveness: 0.8,
            implementation: {
              steps: [],
              complexity: 'medium' as const,
            },
            references: intel.references,
          })),
        })),
        metadata: {
          modelVersion: '1.0.0',
          processingTime,
          dataQuality: 0.9,
          confidenceRange: [0.7, 0.95],
        },
        timestamp: new Date(),
      };

    } catch (error: any) {
      logger.error('Intelligence query failed:', error);
      throw error;
    }
  }

  /**
   * Extract query from input
   */
  private extractQuery(input: any): IntelligenceQuery {
    if (typeof input === 'string') {
      return { text: input, indicators: [], tags: [] };
    }

    return {
      text: input.description || '',
      indicators: input.indicators || [],
      tags: input.tags || [],
      threatTypes: input.threatTypes || [],
      technologies: input.technologies || [],
    };
  }

  /**
   * Search intelligence database
   */
  private async searchIntelligence(query: IntelligenceQuery): Promise<ThreatIntelligence[]> {
    const results: ThreatIntelligence[] = [];
    const searchTerms = this.extractSearchTerms(query);

    // Search threat database
    this.threatDatabase.forEach(threat => {
      if (this.matchesThreat(threat, searchTerms)) {
        results.push(threat);
      }
    });

    // Search CVE database
    this.cveDatabase.forEach((cve, cveId) => {
      if (this.matchesCVE(cve, searchTerms)) {
        results.push(this.cveToThreatIntel(cve));
      }
    });

    // Search MITRE patterns
    this.mitreAttackPatterns.forEach((pattern, patternId) => {
      if (this.matchesMitrePattern(pattern, searchTerms)) {
        results.push(this.mitreToThreatIntel(pattern));
      }
    });

    // Check cache for external results
    const cacheKey = this.generateCacheKey(query);
    const cached = this.intelligenceCache.get(cacheKey);
    
    if (cached && !this.isCacheExpired(cached)) {
      results.push(...cached.data);
    } else {
      // Query external sources if needed
      const externalResults = await this.queryExternalSources(query);
      results.push(...externalResults);
      
      // Cache results
      this.intelligenceCache.set(cacheKey, {
        data: externalResults,
        timestamp: Date.now(),
      });
    }

    // Sort by relevance
    return results.sort((a, b) => 
      this.calculateRelevance(b, query) - this.calculateRelevance(a, query)
    ).slice(0, 10);
  }

  /**
   * Extract search terms from query
   */
  private extractSearchTerms(query: IntelligenceQuery): string[] {
    const terms: string[] = [];
    
    // Add text terms
    if (query.text) {
      terms.push(...query.text.toLowerCase().split(/\s+/));
    }
    
    // Add indicators
    terms.push(...query.indicators);
    
    // Add tags
    terms.push(...query.tags);
    
    // Add threat types
    terms.push(...(query.threatTypes || []));
    
    return [...new Set(terms)]; // Remove duplicates
  }

  /**
   * Check if threat matches search terms
   */
  private matchesThreat(threat: ThreatIntelligence, terms: string[]): boolean {
    const threatText = [
      threat.type,
      threat.description,
      ...threat.indicators,
      ...threat.mitigations,
    ].join(' ').toLowerCase();

    return terms.some(term => threatText.includes(term.toLowerCase()));
  }

  /**
   * Check if CVE matches search terms
   */
  private matchesCVE(cve: CVEEntry, terms: string[]): boolean {
    const cveText = [
      cve.id,
      cve.description,
      ...cve.affectedSoftware,
    ].join(' ').toLowerCase();

    return terms.some(term => cveText.includes(term.toLowerCase()));
  }

  /**
   * Check if MITRE pattern matches search terms
   */
  private matchesMitrePattern(pattern: MitrePattern, terms: string[]): boolean {
    const patternText = [
      pattern.name,
      pattern.description,
      pattern.tactic,
      ...pattern.indicators,
    ].join(' ').toLowerCase();

    return terms.some(term => patternText.includes(term.toLowerCase()));
  }

  /**
   * Convert CVE to threat intelligence format
   */
  private cveToThreatIntel(cve: CVEEntry): ThreatIntelligence {
    return {
      id: cve.id,
      source: ThreatIntelSource.NVD,
      type: 'Vulnerability',
      severity: cve.severity,
      description: cve.description,
      indicators: cve.affectedSoftware,
      mitigations: cve.mitigations,
      references: [`https://nvd.nist.gov/vuln/detail/${cve.id}`],
      lastUpdated: new Date(),
    };
  }

  /**
   * Convert MITRE pattern to threat intelligence format
   */
  private mitreToThreatIntel(pattern: MitrePattern): ThreatIntelligence {
    return {
      id: pattern.id,
      source: ThreatIntelSource.MITRE,
      type: pattern.name,
      severity: 'high',
      description: pattern.description,
      indicators: pattern.indicators,
      mitigations: pattern.mitigations,
      references: [`https://attack.mitre.org/techniques/${pattern.id}/`],
      lastUpdated: new Date(),
    };
  }

  /**
   * Query external sources
   */
  private async queryExternalSources(query: IntelligenceQuery): Promise<ThreatIntelligence[]> {
    const results: ThreatIntelligence[] = [];
    
    // In production, these would be real API calls
    // For now, return empty results
    
    return results;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: IntelligenceQuery): string {
    const queryStr = JSON.stringify({
      text: query.text,
      indicators: query.indicators.sort(),
      tags: query.tags.sort(),
    });
    
    return createHash('md5').update(queryStr).digest('hex');
  }

  /**
   * Check if cache is expired
   */
  private isCacheExpired(cached: CachedIntelligence): boolean {
    const expiryTime = 3600000; // 1 hour
    return Date.now() - cached.timestamp > expiryTime;
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(intel: ThreatIntelligence, query: IntelligenceQuery): number {
    let score = 0.5; // Base score

    // Increase score for matching indicators
    const queryIndicators = new Set(query.indicators);
    const matchingIndicators = intel.indicators.filter(i => queryIndicators.has(i)).length;
    score += matchingIndicators * 0.1;

    // Increase score for severity
    const severityScores = { critical: 0.3, high: 0.2, medium: 0.1, low: 0.05 };
    score += severityScores[intel.severity] || 0;

    // Increase score for recency
    const daysSinceUpdate = (Date.now() - intel.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) score += 0.2;
    else if (daysSinceUpdate < 30) score += 0.1;

    return Math.min(score, 0.95);
  }

  /**
   * Generate intelligence explanation
   */
  private generateIntelligenceExplanation(intel: ThreatIntelligence): string {
    return `${intel.type} threat identified from ${intel.source}. ${intel.description} ` +
           `Severity: ${intel.severity}. Last updated: ${intel.lastUpdated.toLocaleDateString()}.`;
  }

  /**
   * Convert intelligence to evidence
   */
  private intelligenceToEvidence(intel: ThreatIntelligence): Evidence[] {
    return [
      {
        source: `Threat Intelligence - ${intel.source}`,
        relevance: 0.9,
        description: intel.description,
      },
      ...intel.indicators.slice(0, 3).map(indicator => ({
        source: 'Indicator of Compromise',
        relevance: 0.8,
        description: indicator,
      })),
    ];
  }

  /**
   * Get related threats
   */
  private getRelatedThreats(intel: ThreatIntelligence): string[] {
    // Map threat types to related threats
    const relatedMap: Record<string, string[]> = {
      'Ransomware': ['Data Encryption', 'Extortion', 'System Unavailability'],
      'Vulnerability': ['Exploitation', 'System Compromise', 'Data Breach'],
      'Malware': ['System Infection', 'Data Theft', 'Backdoor Access'],
      'Phishing': ['Credential Theft', 'Social Engineering', 'Account Compromise'],
    };

    return relatedMap[intel.type] || ['Unknown Related Threats'];
  }

  /**
   * Get threat statistics
   */
  getThreatStats(): any {
    return {
      totalThreats: this.threatDatabase.size,
      cveEntries: this.cveDatabase.size,
      mitrePatterns: this.mitreAttackPatterns.size,
      cachedQueries: this.intelligenceCache.size,
      sources: [
        ThreatIntelSource.INTERNAL,
        ThreatIntelSource.MITRE,
        ThreatIntelSource.NVD,
        ThreatIntelSource.VIRUSTOTAL,
      ],
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.intelligenceCache.clear();
    logger.info('Threat intelligence service shutdown');
  }
}

// Helper interfaces
interface CVEEntry {
  id: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvss: number;
  affectedSoftware: string[];
  mitigations: string[];
  exploitAvailable: boolean;
}

interface MitrePattern {
  id: string;
  name: string;
  tactic: string;
  description: string;
  mitigations: string[];
  indicators: string[];
}

interface IntelligenceQuery {
  text: string;
  indicators: string[];
  tags: string[];
  threatTypes?: string[];
  technologies?: string[];
}

interface CachedIntelligence {
  data: ThreatIntelligence[];
  timestamp: number;
}
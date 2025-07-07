import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import axios from 'axios';
import { logger } from '../utils/logger';
import {
  ThreatIntelligence,
  ThreatFeed,
  ContextualThreatData
} from '../types/ai';
import { ThreatSeverity } from '../types/shared';

export class ThreatIntelligenceService {
  private threatFeeds: Map<string, ThreatFeed> = new Map();
  private lastUpdate: Date = new Date();

  constructor(
    private db: Pool,
    private redis: RedisClientType
  ) {
    this.initializeThreatFeeds();
  }

  /**
   * Initialize threat intelligence feeds
   */
  private async initializeThreatFeeds(): Promise<void> {
    try {
      // Default open source threat feeds
      const defaultFeeds: ThreatFeed[] = [
        {
          id: 'mitre-attack',
          name: 'MITRE ATT&CK Framework',
          provider: 'MITRE Corporation',
          feed_type: 'open_source',
          format: 'stix',
          update_frequency: 'weekly',
          reliability_score: 0.95,
          endpoint_url: 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json',
          last_updated: new Date(),
          active: true
        },
        {
          id: 'cve-database',
          name: 'CVE Database',
          provider: 'NIST',
          feed_type: 'government',
          format: 'json',
          update_frequency: 'daily',
          reliability_score: 0.9,
          endpoint_url: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
          last_updated: new Date(),
          active: true
        },
        {
          id: 'cwe-database',
          name: 'CWE Database',
          provider: 'MITRE Corporation',
          feed_type: 'open_source',
          format: 'xml',
          update_frequency: 'monthly',
          reliability_score: 0.9,
          endpoint_url: 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip',
          last_updated: new Date(),
          active: true
        }
      ];

      for (const feed of defaultFeeds) {
        this.threatFeeds.set(feed.id, feed);
      }

      logger.info(`Initialized ${defaultFeeds.length} threat intelligence feeds`);
    } catch (error) {
      logger.error('Error initializing threat feeds:', error);
    }
  }

  /**
   * Update threat intelligence data from all active feeds
   */
  async updateThreatIntelligence(): Promise<void> {
    try {
      const updatePromises = Array.from(this.threatFeeds.values())
        .filter(feed => feed.active)
        .map(feed => this.updateSingleFeed(feed));

      await Promise.allSettled(updatePromises);
      this.lastUpdate = new Date();
      
      // Cache the update timestamp
      await this.redis.set('threat_intelligence:last_update', this.lastUpdate.toISOString());
      
      logger.info('Threat intelligence update completed');
    } catch (error) {
      logger.error('Error updating threat intelligence:', error);
    }
  }

  /**
   * Update a single threat feed
   */
  private async updateSingleFeed(feed: ThreatFeed): Promise<void> {
    try {
      logger.info(`Updating threat feed: ${feed.name}`);

      const response = await axios.get(feed.endpoint_url, {
        timeout: 30000,
        headers: feed.api_key ? { 'Authorization': `Bearer ${feed.api_key}` } : {},
        maxContentLength: 50 * 1024 * 1024 // 50MB limit
      });

      // Process based on feed format
      let processedData: ThreatIntelligence[] = [];
      
      switch (feed.format) {
        case 'stix':
          processedData = await this.processSTIXData(response.data, feed);
          break;
        case 'json':
          processedData = await this.processJSONData(response.data, feed);
          break;
        case 'xml':
          processedData = await this.processXMLData(response.data, feed);
          break;
        default:
          logger.warn(`Unsupported feed format: ${feed.format}`);
          return;
      }

      // Store in database
      await this.storeThreatIntelligence(processedData);
      
      // Update feed metadata
      feed.last_updated = new Date();
      this.threatFeeds.set(feed.id, feed);

      logger.info(`Successfully updated ${feed.name}: ${processedData.length} indicators`);
    } catch (error) {
      logger.error(`Error updating feed ${feed.name}:`, error);
    }
  }

  /**
   * Process STIX format data
   */
  private async processSTIXData(data: any, feed: ThreatFeed): Promise<ThreatIntelligence[]> {
    const threats: ThreatIntelligence[] = [];

    try {
      const objects = data.objects || [];
      
      for (const obj of objects) {
        if (obj.type === 'attack-pattern' || obj.type === 'malware' || obj.type === 'tool') {
          const threat: ThreatIntelligence = {
            id: obj.id || `${feed.id}-${Date.now()}-${Math.random()}`,
            source: feed.name,
            threat_type: obj.type,
            indicators: {
              iocs: this.extractIOCs(obj),
              ttps: this.extractTTPs(obj),
              attack_vectors: this.extractAttackVectors(obj)
            },
            severity: this.mapSeverity(obj.x_mitre_impact_type),
            confidence: feed.reliability_score,
            first_seen: new Date(obj.created || Date.now()),
            last_seen: new Date(obj.modified || Date.now()),
            geographic_regions: obj.x_mitre_platforms || [],
            industry_sectors: [],
            description: obj.description || '',
            references: obj.external_references?.map((ref: any) => ref.url) || []
          };

          threats.push(threat);
        }
      }
    } catch (error) {
      logger.error('Error processing STIX data:', error);
    }

    return threats;
  }

  /**
   * Process JSON format data
   */
  private async processJSONData(data: any, feed: ThreatFeed): Promise<ThreatIntelligence[]> {
    const threats: ThreatIntelligence[] = [];

    try {
      // Handle CVE feed format
      if (feed.id === 'cve-database' && data.vulnerabilities) {
        for (const vuln of data.vulnerabilities.slice(0, 100)) { // Limit to prevent memory issues
          const cve = vuln.cve;
          
          const threat: ThreatIntelligence = {
            id: cve.id,
            source: feed.name,
            threat_type: 'vulnerability',
            indicators: {
              iocs: [cve.id],
              ttps: cve.references?.reference_data?.map((ref: any) => ref.url) || [],
              attack_vectors: this.extractCVEAttackVectors(cve)
            },
            severity: this.mapCVESeverity(cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore),
            confidence: feed.reliability_score,
            first_seen: new Date(cve.published),
            last_seen: new Date(cve.lastModified || cve.published),
            geographic_regions: [],
            industry_sectors: [],
            description: cve.descriptions?.find((d: any) => d.lang === 'en')?.value || '',
            references: cve.references?.reference_data?.map((ref: any) => ref.url) || []
          };

          threats.push(threat);
        }
      }
    } catch (error) {
      logger.error('Error processing JSON data:', error);
    }

    return threats;
  }

  /**
   * Process XML format data
   */
  private async processXMLData(data: any, feed: ThreatFeed): Promise<ThreatIntelligence[]> {
    // Placeholder for XML processing (CWE data)
    // In production, would use xml2js or similar parser
    return [];
  }

  /**
   * Store threat intelligence in database
   */
  private async storeThreatIntelligence(threats: ThreatIntelligence[]): Promise<void> {
    if (threats.length === 0) return;

    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      for (const threat of threats) {
        await client.query(`
          INSERT INTO threat_intelligence (
            id, source, threat_type, indicators, severity, confidence,
            first_seen, last_seen, geographic_regions, industry_sectors,
            description, references, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            indicators = EXCLUDED.indicators,
            severity = EXCLUDED.severity,
            confidence = EXCLUDED.confidence,
            last_seen = EXCLUDED.last_seen,
            geographic_regions = EXCLUDED.geographic_regions,
            industry_sectors = EXCLUDED.industry_sectors,
            description = EXCLUDED.description,
            references = EXCLUDED.references,
            updated_at = NOW()
        `, [
          threat.id,
          threat.source,
          threat.threat_type,
          JSON.stringify(threat.indicators),
          threat.severity,
          threat.confidence,
          threat.first_seen,
          threat.last_seen,
          threat.geographic_regions,
          threat.industry_sectors,
          threat.description,
          threat.references
        ]);
      }

      await client.query('COMMIT');
      logger.info(`Stored ${threats.length} threat intelligence indicators`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error storing threat intelligence:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get contextual threat intelligence for enhanced threat suggestions
   */
  async getContextualThreatIntelligence(context: ContextualThreatData): Promise<ThreatIntelligence[]> {
    try {
      const cacheKey = `contextual_threat_intel:${JSON.stringify(context).slice(0, 100)}`;
      
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build query based on context
      const threats = await this.queryThreatIntelligence(context);
      
      // Cache for 1 hour
      await this.redis.setEx(cacheKey, 3600, JSON.stringify(threats));
      
      return threats;
    } catch (error) {
      logger.error('Error getting contextual threat intelligence:', error);
      return [];
    }
  }

  /**
   * Query threat intelligence based on contextual data
   */
  private async queryThreatIntelligence(context: ContextualThreatData): Promise<ThreatIntelligence[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by technologies used in system components
    const technologies = context.system_components
      .flatMap(comp => comp.technologies)
      .filter(tech => tech);

    if (technologies.length > 0) {
      conditions.push(`(description ILIKE ANY($${paramIndex}))`);
      params.push(technologies.map(tech => `%${tech}%`));
      paramIndex++;
    }

    // Filter by protocols
    const protocols = context.data_flows
      .flatMap(flow => flow.protocols)
      .filter(protocol => protocol);

    if (protocols.length > 0) {
      conditions.push(`(description ILIKE ANY($${paramIndex}))`);
      params.push(protocols.map(protocol => `%${protocol}%`));
      paramIndex++;
    }

    // Filter by business context
    if (context.business_context.industry) {
      conditions.push(`($${paramIndex} = ANY(industry_sectors) OR industry_sectors = '{}')`);
      params.push(context.business_context.industry);
      paramIndex++;
    }

    // Build final query
    let query = `
      SELECT * FROM threat_intelligence
      WHERE last_seen >= NOW() - INTERVAL '1 year'
    `;

    if (conditions.length > 0) {
      query += ` AND (${conditions.join(' OR ')})`;
    }

    query += `
      ORDER BY confidence DESC, last_seen DESC
      LIMIT 50
    `;

    const result = await this.db.query(query, params);
    
    return result.rows.map(row => ({
      ...row,
      indicators: JSON.parse(row.indicators),
      first_seen: new Date(row.first_seen),
      last_seen: new Date(row.last_seen)
    }));
  }

  /**
   * Extract IOCs from STIX object
   */
  private extractIOCs(obj: any): string[] {
    const iocs: string[] = [];
    
    if (obj.pattern) {
      iocs.push(obj.pattern);
    }
    
    if (obj.x_mitre_data_sources) {
      iocs.push(...obj.x_mitre_data_sources);
    }

    return iocs;
  }

  /**
   * Extract TTPs from STIX object
   */
  private extractTTPs(obj: any): string[] {
    const ttps: string[] = [];
    
    if (obj.kill_chain_phases) {
      ttps.push(...obj.kill_chain_phases.map((phase: any) => `${phase.kill_chain_name}:${phase.phase_name}`));
    }

    if (obj.x_mitre_tactics) {
      ttps.push(...obj.x_mitre_tactics);
    }

    return ttps;
  }

  /**
   * Extract attack vectors from STIX object
   */
  private extractAttackVectors(obj: any): string[] {
    const vectors: string[] = [];
    
    if (obj.x_mitre_platforms) {
      vectors.push(...obj.x_mitre_platforms);
    }

    return vectors;
  }

  /**
   * Extract attack vectors from CVE data
   */
  private extractCVEAttackVectors(cve: any): string[] {
    const vectors: string[] = [];
    
    const metrics = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
    if (metrics) {
      if (metrics.attackVector) vectors.push(metrics.attackVector);
      if (metrics.attackComplexity) vectors.push(metrics.attackComplexity);
    }

    return vectors;
  }

  /**
   * Map STIX severity to our severity enum
   */
  private mapSeverity(impactType: string): ThreatSeverity {
    switch (impactType?.toLowerCase()) {
      case 'high': return ThreatSeverity.HIGH;
      case 'medium': return ThreatSeverity.MEDIUM;
      case 'low': return ThreatSeverity.LOW;
      default: return ThreatSeverity.MEDIUM;
    }
  }

  /**
   * Map CVE CVSS score to severity
   */
  private mapCVESeverity(score: number): ThreatSeverity {
    if (!score) return ThreatSeverity.MEDIUM;
    
    if (score >= 9.0) return ThreatSeverity.CRITICAL;
    if (score >= 7.0) return ThreatSeverity.HIGH;
    if (score >= 4.0) return ThreatSeverity.MEDIUM;
    if (score > 0.0) return ThreatSeverity.LOW;
    return ThreatSeverity.INFO;
  }

  /**
   * Get threat intelligence statistics
   */
  async getStatistics(): Promise<{
    total_indicators: number;
    feeds_active: number;
    last_update: Date;
    indicators_by_type: Record<string, number>;
    top_sources: Array<{ source: string; count: number }>;
  }> {
    try {
      const [totalResult, typeResult, sourceResult] = await Promise.all([
        this.db.query('SELECT COUNT(*) as total FROM threat_intelligence'),
        this.db.query(`
          SELECT threat_type, COUNT(*) as count 
          FROM threat_intelligence 
          GROUP BY threat_type 
          ORDER BY count DESC
        `),
        this.db.query(`
          SELECT source, COUNT(*) as count 
          FROM threat_intelligence 
          GROUP BY source 
          ORDER BY count DESC 
          LIMIT 10
        `)
      ]);

      const indicatorsByType: Record<string, number> = {};
      typeResult.rows.forEach(row => {
        indicatorsByType[row.threat_type] = parseInt(row.count);
      });

      return {
        total_indicators: parseInt(totalResult.rows[0].total),
        feeds_active: Array.from(this.threatFeeds.values()).filter(f => f.active).length,
        last_update: this.lastUpdate,
        indicators_by_type: indicatorsByType,
        top_sources: sourceResult.rows.map(row => ({
          source: row.source,
          count: parseInt(row.count)
        }))
      };
    } catch (error) {
      logger.error('Error getting threat intelligence statistics:', error);
      throw error;
    }
  }
}
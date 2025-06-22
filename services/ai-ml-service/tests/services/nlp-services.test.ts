import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ThreatIntelligenceNLPService } from '../../src/services/threat-intelligence-nlp.service';
import { EntityExtractionService } from '../../src/services/entity-extraction.service';
import { SentimentAnalysisService } from '../../src/services/sentiment-analysis.service';
import { SecurityTextClassifierService } from '../../src/services/security-text-classifier.service';

describe('NLP Services Tests', () => {
  describe('ThreatIntelligenceNLPService', () => {
    let service: ThreatIntelligenceNLPService;

    beforeEach(async () => {
      service = new ThreatIntelligenceNLPService();
      await service.initialize();
    });

    it('should initialize successfully', () => {
      expect(service).toBeDefined();
    });

    it('should parse threat intelligence documents', async () => {
      const request = {
        text: 'APT28 has been observed using a new variant of Sofacy malware targeting government institutions. The malware exploits CVE-2023-1234 vulnerability in Windows systems.',
        documentType: 'threat-report' as const,
        options: {
          includeEntities: true,
          includeRelationships: true,
          includeSummary: true,
        },
      };

      const result = await service.parseThreatIntelligence(request);

      expect(result).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);
      
      // Check for threat actor
      const threatActor = result.entities.find((e: any) => e.type === 'THREAT_ACTOR');
      expect(threatActor).toBeDefined();
      expect(threatActor.text).toBe('APT28');

      // Check for CVE
      const cve = result.entities.find((e: any) => e.type === 'CVE');
      expect(cve).toBeDefined();
      expect(cve.text).toBe('CVE-2023-1234');

      // Check for malware
      const malware = result.entities.find((e: any) => e.type === 'MALWARE');
      expect(malware).toBeDefined();
      expect(malware.text).toBe('Sofacy');
    });

    it('should extract temporal information', async () => {
      const request = {
        text: 'The attack campaign started in January 2024 and lasted for 3 months. Daily attacks were observed between 2:00 AM and 4:00 AM UTC.',
        documentType: 'incident-report' as const,
        options: {
          includeEntities: true,
          includeTemporal: true,
        },
      };

      const result = await service.parseThreatIntelligence(request);

      expect(result.temporalInfo).toBeDefined();
      expect(result.temporalInfo.dates).toContain('January 2024');
      expect(result.temporalInfo.durations).toContain('3 months');
      expect(result.temporalInfo.times).toContain('2:00 AM');
    });

    it('should generate document summary', async () => {
      const request = {
        text: 'A sophisticated phishing campaign has been targeting financial institutions. The attackers use fake banking websites to steal credentials. Multi-factor authentication can help prevent these attacks.',
        documentType: 'threat-advisory' as const,
        options: {
          includeSummary: true,
        },
      };

      const result = await service.parseThreatIntelligence(request);

      expect(result.summary).toBeDefined();
      expect(result.summary.toLowerCase()).toContain('phishing');
      expect(result.summary.toLowerCase()).toContain('financial');
    });
  });

  describe('EntityExtractionService', () => {
    let service: EntityExtractionService;

    beforeEach(async () => {
      service = new EntityExtractionService();
      await service.initialize();
    });

    it('should extract IOCs from text', async () => {
      const request = {
        text: 'The malware communicates with C2 server at 192.168.1.100:8080. It also connects to malicious.example.com and downloads payload from http://evil.site/payload.exe',
        options: {
          extractIOCs: true,
          validateEntities: true,
        },
      };

      const result = await service.extractEntities(request);

      expect(result.iocs).toBeDefined();
      
      // Check IP address
      const ipIOC = result.iocs.find((ioc: any) => ioc.type === 'IP');
      expect(ipIOC).toBeDefined();
      expect(ipIOC.value).toBe('192.168.1.100');

      // Check domain
      const domainIOC = result.iocs.find((ioc: any) => ioc.type === 'DOMAIN');
      expect(domainIOC).toBeDefined();
      expect(domainIOC.value).toContain('example.com');

      // Check URL
      const urlIOC = result.iocs.find((ioc: any) => ioc.type === 'URL');
      expect(urlIOC).toBeDefined();
      expect(urlIOC.value).toContain('evil.site');
    });

    it('should extract TTPs', async () => {
      const request = {
        text: 'The threat actor uses spear phishing emails (T1566.001) for initial access and then performs credential dumping (T1003) to escalate privileges.',
        options: {
          extractTTPs: true,
        },
      };

      const result = await service.extractEntities(request);

      expect(result.ttps).toBeDefined();
      expect(result.ttps.length).toBeGreaterThanOrEqual(2);
      
      const spearPhishing = result.ttps.find((ttp: any) => ttp.techniqueId === 'T1566.001');
      expect(spearPhishing).toBeDefined();
      expect(spearPhishing.name).toContain('phishing');

      const credDumping = result.ttps.find((ttp: any) => ttp.techniqueId === 'T1003');
      expect(credDumping).toBeDefined();
    });

    it('should validate and enrich entities', async () => {
      const request = {
        text: 'CVE-2023-12345 is a critical vulnerability in Apache Log4j. The malware hash is d41d8cd98f00b204e9800998ecf8427e.',
        options: {
          extractIOCs: true,
          validateEntities: true,
          enrichEntities: true,
        },
      };

      const result = await service.extractEntities(request);

      // Check CVE
      const cve = result.entities.find((e: any) => e.type === 'CVE');
      expect(cve).toBeDefined();
      expect(cve.validated).toBe(true);

      // Check hash
      const hash = result.iocs.find((ioc: any) => ioc.type === 'HASH');
      expect(hash).toBeDefined();
      expect(hash.hashType).toBe('MD5');
    });
  });

  describe('SentimentAnalysisService', () => {
    let service: SentimentAnalysisService;

    beforeEach(async () => {
      service = new SentimentAnalysisService();
      await service.initialize();
    });

    it('should analyze security sentiment', async () => {
      const request = {
        text: 'CRITICAL: Immediate action required! A severe vulnerability has been discovered that poses an extreme risk to all systems.',
        context: {
          domain: 'security',
          documentType: 'alert',
        },
      };

      const result = await service.analyzeSentiment(request);

      expect(result).toBeDefined();
      expect(result.overallScore).toBeLessThan(0); // Negative sentiment
      expect(result.urgency).toBe('critical');
      expect(result.threatPerception).toBe('severe');
    });

    it('should detect urgency levels', async () => {
      const criticalRequest = {
        text: 'URGENT: Critical zero-day exploit in the wild. Patch immediately!',
        context: { domain: 'security' },
      };

      const normalRequest = {
        text: 'Monthly security update available. Please install at your convenience.',
        context: { domain: 'security' },
      };

      const criticalResult = await service.analyzeSentiment(criticalRequest);
      const normalResult = await service.analyzeSentiment(normalRequest);

      expect(criticalResult.urgency).toBe('critical');
      expect(normalResult.urgency).toBe('normal');
    });

    it('should analyze emotion in security communications', async () => {
      const request = {
        text: 'We are deeply concerned about the recent breach. Our team is working frantically to contain the damage.',
        context: {
          domain: 'security',
          documentType: 'incident-response',
        },
      };

      const result = await service.analyzeSentiment(request);

      expect(result.emotions).toBeDefined();
      expect(result.emotions.concern).toBeGreaterThan(0.5);
      expect(result.emotions.urgency).toBeGreaterThan(0.5);
    });
  });

  describe('SecurityTextClassifierService', () => {
    let service: SecurityTextClassifierService;

    beforeEach(async () => {
      service = new SecurityTextClassifierService();
      await service.initialize();
    });

    it('should classify security text with multiple labels', async () => {
      const request = {
        text: 'SQL injection vulnerability found in login form. This could lead to unauthorized database access and data theft.',
        options: {
          multiLabel: true,
          includeConfidence: true,
          topK: 5,
        },
      };

      const result = await service.classifyText(request);

      expect(result.classifications).toBeDefined();
      expect(result.classifications.length).toBeGreaterThan(0);

      // Check for vulnerability classification
      const vulnClass = result.classifications.find((c: any) => 
        c.category === 'vulnerability' || c.label.toLowerCase().includes('injection')
      );
      expect(vulnClass).toBeDefined();
      expect(vulnClass.confidence).toBeGreaterThan(0.5);
    });

    it('should classify threat severity', async () => {
      const request = {
        text: 'Critical remote code execution vulnerability affecting all versions. Exploitation is trivial and attacks have been observed in the wild.',
        options: {
          includeConfidence: true,
        },
      };

      const result = await service.classifyText(request);

      const severityClass = result.classifications.find((c: any) => 
        c.category === 'severity'
      );
      expect(severityClass).toBeDefined();
      expect(severityClass.label).toBe('critical');
    });

    it('should identify attack vectors', async () => {
      const request = {
        text: 'The attacker sends specially crafted HTTP requests to exploit a buffer overflow in the web server.',
        options: {
          multiLabel: true,
        },
      };

      const result = await service.classifyText(request);

      const attackVector = result.classifications.find((c: any) => 
        c.category === 'attack_vector'
      );
      expect(attackVector).toBeDefined();
      expect(attackVector.label.toLowerCase()).toContain('web');
    });
  });

  describe('NLP Integration Tests', () => {
    let threatNLP: ThreatIntelligenceNLPService;
    let entityExtraction: EntityExtractionService;
    let sentiment: SentimentAnalysisService;
    let classifier: SecurityTextClassifierService;

    beforeEach(async () => {
      threatNLP = new ThreatIntelligenceNLPService();
      entityExtraction = new EntityExtractionService();
      sentiment = new SentimentAnalysisService();
      classifier = new SecurityTextClassifierService();

      await Promise.all([
        threatNLP.initialize(),
        entityExtraction.initialize(),
        sentiment.initialize(),
        classifier.initialize(),
      ]);
    });

    it('should process complete threat report with all NLP services', async () => {
      const threatReport = `
        CRITICAL SECURITY ADVISORY - CVE-2024-12345
        
        A critical vulnerability has been discovered in ProductX version 2.0-2.5. 
        The vulnerability allows remote code execution without authentication.
        
        Technical Details:
        - Attack Vector: Network
        - CVSS Score: 9.8
        - Affected Systems: Windows Server 2019, 2022
        - Exploit Available: Yes
        - IOCs: 
          - Malicious IP: 10.0.0.100
          - C2 Domain: evil.malware.com
          - File Hash: abc123def456
        
        The APT group "DarkHydra" has been observed exploiting this vulnerability
        in targeted attacks against financial institutions. Immediate patching is required.
        
        Mitigation:
        1. Apply security patch KB5012345
        2. Block the listed IOCs at firewall
        3. Monitor for suspicious network activity
      `;

      // Run all NLP services
      const [nlpResult, entityResult, sentimentResult, classResult] = await Promise.all([
        threatNLP.parseThreatIntelligence({
          text: threatReport,
          documentType: 'threat-advisory' as const,
          options: { includeAll: true },
        }),
        entityExtraction.extractEntities({
          text: threatReport,
          options: { extractAll: true },
        }),
        sentiment.analyzeSentiment({
          text: threatReport,
          context: { domain: 'security' },
        }),
        classifier.classifyText({
          text: threatReport,
          options: { multiLabel: true },
        }),
      ]);

      // Verify comprehensive results
      expect(nlpResult.entities).toContainEqual(
        expect.objectContaining({ type: 'CVE', text: 'CVE-2024-12345' })
      );
      expect(nlpResult.entities).toContainEqual(
        expect.objectContaining({ type: 'THREAT_ACTOR', text: 'DarkHydra' })
      );

      expect(entityResult.iocs).toContainEqual(
        expect.objectContaining({ type: 'IP', value: '10.0.0.100' })
      );
      expect(entityResult.iocs).toContainEqual(
        expect.objectContaining({ type: 'DOMAIN', value: 'evil.malware.com' })
      );

      expect(sentimentResult.urgency).toBe('critical');
      expect(sentimentResult.threatPerception).toBe('severe');

      expect(classResult.classifications).toContainEqual(
        expect.objectContaining({ 
          category: 'vulnerability',
          label: expect.stringContaining('RCE'),
        })
      );
    });
  });
});
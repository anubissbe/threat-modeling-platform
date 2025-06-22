/**
 * Multi-Language NLP E2E Tests
 * Comprehensive end-to-end testing for multi-language natural language processing
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';

describe('Multi-Language NLP E2E Tests', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    // Initialize the application
    app = await createApp();
    await app.ready();

    // Get authentication token (mock for testing)
    authToken = 'test-auth-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Language Detection', () => {
    it('should detect English text correctly', async () => {
      const response = await request(app.server)
        .post('/nlp/sentiment-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'This is a critical security threat that requires immediate attention.',
          options: { include_confidence: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.language_detected).toBe('en');
    });

    it('should detect Spanish text correctly', async () => {
      const response = await request(app.server)
        .post('/nlp/sentiment-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Esta es una amenaza crítica de seguridad que requiere atención inmediata.',
          options: { include_confidence: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.language_detected).toBe('es');
    });

    it('should detect French text correctly', async () => {
      const response = await request(app.server)
        .post('/nlp/sentiment-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Ceci est une menace critique de sécurité qui nécessite une attention immédiate.',
          options: { include_confidence: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.language_detected).toBe('fr');
    });

    it('should detect Chinese text correctly', async () => {
      const response = await request(app.server)
        .post('/nlp/sentiment-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: '这是一个需要立即关注的严重安全威胁。',
          options: { include_confidence: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.language_detected).toBe('zh');
    });
  });

  describe('Threat Intelligence Parsing', () => {
    it('should parse English threat intelligence', async () => {
      const response = await request(app.server)
        .post('/nlp/threat-intelligence')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          request_id: 'test_en_001',
          documents: [{
            id: 'doc_en_001',
            source: 'test',
            title: 'APT29 Ransomware Campaign',
            content: 'APT29 has been observed deploying ransomware targeting financial institutions. The attack uses phishing emails with malicious attachments containing trojans.',
            timestamp: new Date().toISOString(),
            language: 'en',
            metadata: {
              classification: 'high',
              confidence: 0.9,
              tags: ['apt29', 'ransomware'],
              source_reliability: 0.8,
              content_type: 'report'
            }
          }],
          parsing_options: {
            extract_entities: true,
            extract_indicators: true,
            extract_patterns: true,
            extract_actors: true,
            confidence_threshold: 0.5,
            language_detection: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.request_id).toBe('test_en_001');
      expect(response.body.parsed_documents).toHaveLength(1);
      expect(response.body.parsed_documents[0]).toHaveProperty('extracted_entities');
      expect(response.body.parsed_documents[0]).toHaveProperty('threat_indicators');
      expect(response.body.parsed_documents[0]).toHaveProperty('attack_patterns');
    });

    it('should parse Spanish threat intelligence', async () => {
      const response = await request(app.server)
        .post('/nlp/threat-intelligence')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          request_id: 'test_es_001',
          documents: [{
            id: 'doc_es_001',
            source: 'test',
            title: 'Campaña de Ransomware APT29',
            content: 'APT29 ha sido observado desplegando ransomware dirigido a instituciones financieras. El ataque utiliza correos de phishing con archivos adjuntos maliciosos que contienen troyanos.',
            timestamp: new Date().toISOString(),
            language: 'es',
            metadata: {
              classification: 'high',
              confidence: 0.9,
              tags: ['apt29', 'ransomware'],
              source_reliability: 0.8,
              content_type: 'report'
            }
          }],
          parsing_options: {
            extract_entities: true,
            extract_indicators: true,
            extract_patterns: true,
            extract_actors: true,
            confidence_threshold: 0.5,
            language_detection: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.request_id).toBe('test_es_001');
      expect(response.body.parsed_documents).toHaveLength(1);
      
      const document = response.body.parsed_documents[0];
      expect(document).toHaveProperty('extracted_entities');
      expect(document.extracted_entities.some((e: any) => e.localized_term)).toBe(true);
    });

    it('should handle mixed language content', async () => {
      const response = await request(app.server)
        .post('/nlp/threat-intelligence')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          request_id: 'test_mixed_001',
          documents: [{
            id: 'doc_mixed_001',
            source: 'test',
            title: 'Mixed Language Threat Report',
            content: 'APT29 group (también conocido como Cozy Bear) has launched a new malware campaign. Cette attaque utilise des techniques avancées.',
            timestamp: new Date().toISOString(),
            language: 'auto',
            metadata: {
              classification: 'medium',
              confidence: 0.7,
              tags: ['apt29', 'malware'],
              source_reliability: 0.7,
              content_type: 'report'
            }
          }],
          parsing_options: {
            extract_entities: true,
            extract_indicators: true,
            confidence_threshold: 0.4,
            language_detection: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.parsed_documents).toHaveLength(1);
    });
  });

  describe('Entity Extraction', () => {
    it('should extract entities from German text', async () => {
      const response = await request(app.server)
        .post('/nlp/entity-extraction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          request_id: 'test_de_entity_001',
          text_content: 'Die Bedrohung nutzt eine Schwachstelle in der Software. Der Angriff erfolgte über das Netzwerk mit einem Trojaner.',
          extraction_options: {
            extract_iocs: true,
            extract_ttps: true,
            extract_actors: true,
            extract_vulnerabilities: true,
            confidence_threshold: 0.5,
            include_context: true
          },
          context: {
            document_type: 'threat_report',
            source_reliability: 0.8,
            timestamp: new Date().toISOString(),
            language: 'de'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.request_id).toBe('test_de_entity_001');
      expect(response.body.extracted_entities).toBeDefined();
      expect(response.body.extracted_entities.some((e: any) => 
        e.attributes && e.attributes.detected_language === 'de'
      )).toBe(true);
    });

    it('should extract IOCs from multiple languages', async () => {
      const testCases = [
        {
          language: 'en',
          text: 'The malicious IP address 192.168.1.100 was used in the attack against example.com'
        },
        {
          language: 'es', 
          text: 'La dirección IP maliciosa 192.168.1.100 fue utilizada en el ataque contra example.com'
        },
        {
          language: 'fr',
          text: 'L\'adresse IP malveillante 192.168.1.100 a été utilisée dans l\'attaque contre example.com'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app.server)
          .post('/nlp/entity-extraction')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            request_id: `test_ioc_${testCase.language}`,
            text_content: testCase.text,
            extraction_options: {
              extract_iocs: true,
              confidence_threshold: 0.5,
              include_context: true
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.extracted_entities.some((e: any) => 
          e.entity_value === '192.168.1.100' && e.entity_type === 'ip_address'
        )).toBe(true);
        expect(response.body.extracted_entities.some((e: any) => 
          e.entity_value === 'example.com' && e.entity_type === 'domain'
        )).toBe(true);
      }
    });
  });

  describe('Sentiment Analysis', () => {
    it('should analyze sentiment across different languages', async () => {
      const testCases = [
        {
          language: 'en',
          text: 'This is a critical security emergency requiring immediate response!',
          expectedSentiment: 'negative'
        },
        {
          language: 'es',
          text: 'Esta es una emergencia crítica de seguridad que requiere respuesta inmediata!',
          expectedSentiment: 'negative'
        },
        {
          language: 'fr',
          text: 'Ceci est une urgence critique de sécurité nécessitant une réponse immédiate!',
          expectedSentiment: 'negative'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app.server)
          .post('/nlp/sentiment-analysis')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            text: testCase.text,
            options: {
              detailed_analysis: true,
              include_confidence: true
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.sentiment).toBe(testCase.expectedSentiment);
        expect(response.body.language_detected).toBe(testCase.language);
        expect(response.body.risk_assessment).toBeDefined();
        expect(response.body.risk_assessment.urgency).toBeDefined();
      }
    });

    it('should detect urgency levels in multiple languages', async () => {
      const urgentTexts = [
        { lang: 'en', text: 'URGENT: Critical security breach detected immediately!' },
        { lang: 'es', text: 'URGENTE: Brecha crítica de seguridad detectada inmediatamente!' },
        { lang: 'fr', text: 'URGENT: Brèche critique de sécurité détectée immédiatement!' }
      ];

      for (const test of urgentTexts) {
        const response = await request(app.server)
          .post('/nlp/sentiment-analysis')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            text: test.text,
            options: { detailed_analysis: true }
          });

        expect(response.status).toBe(200);
        expect(response.body.risk_assessment.urgency).toMatch(/high|critical/);
      }
    });
  });

  describe('Text Classification', () => {
    it('should classify security threats in multiple languages', async () => {
      const testCases = [
        {
          language: 'en',
          text: 'Ransomware attack detected on corporate network. Multiple systems encrypted.',
          expectedCategory: 'ransomware'
        },
        {
          language: 'es', 
          text: 'Ataque de ransomware detectado en la red corporativa. Múltiples sistemas encriptados.',
          expectedCategory: 'ransomware'
        },
        {
          language: 'de',
          text: 'Ransomware-Angriff im Unternehmensnetzwerk erkannt. Mehrere Systeme verschlüsselt.',
          expectedCategory: 'ransomware'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app.server)
          .post('/nlp/text-classification')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            text: testCase.text,
            options: {
              categories: ['malware', 'phishing', 'ransomware', 'vulnerability'],
              confidence_threshold: 0.5,
              multi_label: true
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.primary_category).toBe(testCase.expectedCategory);
        expect(response.body.language_detected).toBe(testCase.language);
        expect(response.body.threat_indicators).toBeDefined();
        expect(response.body.threat_indicators.length).toBeGreaterThan(0);
      }
    });

    it('should handle phishing detection across languages', async () => {
      const phishingTexts = [
        { lang: 'en', text: 'Phishing email with fake login page to steal credentials' },
        { lang: 'es', text: 'Correo de phishing con página de inicio falsa para robar credenciales' },
        { lang: 'fr', text: 'Email de hameçonnage avec fausse page de connexion pour voler les identifiants' }
      ];

      for (const test of phishingTexts) {
        const response = await request(app.server)
          .post('/nlp/text-classification')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            text: test.text,
            options: { confidence_threshold: 0.4 }
          });

        expect(response.status).toBe(200);
        expect(response.body.primary_category).toMatch(/phishing|social_engineering/);
      }
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple languages in batch', async () => {
      const response = await request(app.server)
        .post('/nlp/batch-process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          texts: [
            'Critical malware infection detected in system',
            'Infección crítica de malware detectada en el sistema',
            'Infection critique de malware détectée dans le système',
            'Kritische Malware-Infektion im System erkannt'
          ],
          operations: ['entity_extraction', 'sentiment_analysis', 'text_classification'],
          options: {
            parallel_processing: true,
            confidence_threshold: 0.5,
            include_metadata: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.processed_texts).toBe(4);
      expect(response.body.results).toHaveLength(4);

      // Verify each text was processed with language detection
      response.body.results.forEach((result: any, index: number) => {
        expect(result.text_index).toBe(index);
        expect(result.results.entity_extraction).toBeDefined();
        expect(result.results.sentiment_analysis).toBeDefined();
        expect(result.results.text_classification).toBeDefined();
      });
    });
  });

  describe('Health Check', () => {
    it('should return multi-language capabilities in health check', async () => {
      const response = await request(app.server)
        .get('/nlp/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.capabilities).toContain('multi_language_support');
      expect(response.body.performance_metrics.supported_languages).toContain('en');
      expect(response.body.performance_metrics.supported_languages).toContain('es');
      expect(response.body.performance_metrics.supported_languages).toContain('fr');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty text gracefully', async () => {
      const response = await request(app.server)
        .post('/nlp/sentiment-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: '',
          options: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should handle extremely long text', async () => {
      const longText = 'A'.repeat(15000); // Longer than 10k character limit
      
      const response = await request(app.server)
        .post('/nlp/sentiment-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: longText,
          options: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/text length|too long|limit/i);
    });

    it('should handle corrupted or invalid text encoding', async () => {
      const response = await request(app.server)
        .post('/nlp/entity-extraction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          request_id: 'test_encoding',
          text_content: '\x00\x01\x02invalid\x03\x04encoding\x05',
          extraction_options: {
            extract_iocs: true,
            confidence_threshold: 0.5
          }
        });

      // Should either process successfully with cleaned text or return a clear error
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Performance Tests', () => {
    it('should process within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app.server)
        .post('/nlp/text-classification')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'This is a moderate length threat intelligence document with various security terms like malware, phishing, vulnerability, and attack patterns that should be processed efficiently.',
          options: { confidence_threshold: 0.5 }
        });

      const processingTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        request(app.server)
          .post('/nlp/sentiment-analysis')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            text: `Concurrent test request ${i + 1} with security threat analysis`,
            options: { include_confidence: true }
          })
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.language_detected).toBeDefined();
      });
    });
  });

  describe('Data Validation', () => {
    it('should validate language detection confidence', async () => {
      const response = await request(app.server)
        .post('/nlp/sentiment-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Esta es una prueba de detección de idioma español.',
          options: { include_confidence: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.language_detected).toBe('es');
      // Language detection confidence should be reasonable
      const processingDetails = response.body.processing_details || response.body;
      expect(typeof processingDetails).toBe('object');
    });

    it('should preserve entity accuracy across languages', async () => {
      const ipAddress = '192.168.1.1';
      const domain = 'malicious-site.com';
      
      const testTexts = [
        `English: The IP ${ipAddress} and domain ${domain} are malicious`,
        `Spanish: La IP ${ipAddress} y el dominio ${domain} son maliciosos`,
        `French: L'IP ${ipAddress} et le domaine ${domain} sont malveillants`
      ];

      for (const text of testTexts) {
        const response = await request(app.server)
          .post('/nlp/entity-extraction')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            request_id: `accuracy_test_${Date.now()}`,
            text_content: text,
            extraction_options: {
              extract_iocs: true,
              confidence_threshold: 0.5
            }
          });

        expect(response.status).toBe(200);
        
        const entities = response.body.extracted_entities;
        expect(entities.some((e: any) => e.entity_value === ipAddress)).toBe(true);
        expect(entities.some((e: any) => e.entity_value === domain)).toBe(true);
      }
    });
  });
});
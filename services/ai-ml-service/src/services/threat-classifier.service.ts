// import * as tf from '@tensorflow/tfjs-node'; // Temporarily disabled for testing
import * as natural from 'natural';
import { logger, mlLogger } from '../utils/logger';
import { ModelType, PredictionRequest, PredictionResponse, Prediction, Evidence } from '../types';
import { config } from '../config';

export class ThreatClassifierService {
  private model: tf.LayersModel | null = null;
  private tokenizer: any;
  private vocabulary: Map<string, number> = new Map();
  private threatCategories: string[] = [
    'Spoofing',
    'Tampering',
    'Repudiation',
    'Information Disclosure',
    'Denial of Service',
    'Elevation of Privilege',
    'Injection',
    'Broken Authentication',
    'Sensitive Data Exposure',
    'XML External Entities',
    'Broken Access Control',
    'Security Misconfiguration',
    'Cross-Site Scripting',
    'Insecure Deserialization',
    'Components with Known Vulnerabilities',
    'Insufficient Logging',
  ];

  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.initializeVocabulary();
  }

  /**
   * Initialize the threat classifier model
   */
  async initialize(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Try to load existing model
      const modelPath = `${config.MODEL_PATH}/threat-classifier`;
      try {
        this.model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
        mlLogger.modelLoaded(ModelType.THREAT_CLASSIFIER, '1.0.0', Date.now() - startTime);
      } catch (error) {
        logger.info('No existing model found, creating new model');
        this.model = this.createModel();
      }

      logger.info('Threat classifier service initialized');
    } catch (error) {
      logger.error('Failed to initialize threat classifier:', error);
      throw error;
    }
  }

  /**
   * Create a new threat classification model
   */
  private createModel(): tf.Sequential {
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 10000, // Vocabulary size
          outputDim: 128,
          inputLength: 100, // Max sequence length
        }),
        tf.layers.lstm({
          units: 128,
          returnSequences: true,
          dropout: 0.2,
        }),
        tf.layers.lstm({
          units: 64,
          dropout: 0.2,
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: this.threatCategories.length,
          activation: 'softmax',
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Initialize vocabulary for text processing
   */
  private initializeVocabulary(): void {
    // Common security-related terms
    const securityTerms = [
      'authentication', 'authorization', 'access', 'control', 'injection',
      'sql', 'xss', 'csrf', 'session', 'cookie', 'token', 'password',
      'encryption', 'hash', 'salt', 'certificate', 'ssl', 'tls',
      'vulnerability', 'exploit', 'attack', 'threat', 'risk', 'breach',
      'data', 'sensitive', 'information', 'disclosure', 'exposure',
      'denial', 'service', 'dos', 'ddos', 'overflow', 'buffer',
      'privilege', 'escalation', 'bypass', 'tamper', 'spoof', 'replay',
      'man-in-the-middle', 'mitm', 'phishing', 'malware', 'ransomware',
      'firewall', 'ids', 'ips', 'waf', 'siem', 'endpoint', 'network',
      'api', 'rest', 'graphql', 'websocket', 'http', 'https',
      'input', 'output', 'validation', 'sanitization', 'encoding',
      'configuration', 'default', 'hardening', 'patch', 'update',
      'audit', 'log', 'monitor', 'alert', 'incident', 'response',
    ];

    // Build vocabulary
    securityTerms.forEach((term, index) => {
      this.vocabulary.set(term.toLowerCase(), index + 1);
    });
  }

  /**
   * Classify threats from description
   */
  async classifyThreats(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();

    try {
      if (!this.model) {
        throw new Error('Model not initialized');
      }

      // Process input text
      const inputText = this.extractTextFromInput(request.input);
      const features = this.textToFeatures(inputText);
      
      // Make prediction
      const inputTensor = tf.tensor2d([features]);
      const predictions = await this.model.predict(inputTensor) as tf.Tensor;
      const probabilities = await predictions.data();
      
      // Clean up tensors
      inputTensor.dispose();
      predictions.dispose();

      // Process results
      const results = this.processClassificationResults(probabilities, request.options);
      
      const processingTime = Date.now() - startTime;
      mlLogger.predictionMade(ModelType.THREAT_CLASSIFIER, results[0]?.confidence || 0, processingTime);

      return {
        success: true,
        modelType: ModelType.THREAT_CLASSIFIER,
        predictions: results,
        metadata: {
          modelVersion: '1.0.0',
          processingTime,
          dataQuality: this.assessDataQuality(inputText),
          confidenceRange: [
            Math.min(...results.map(r => r.confidence)),
            Math.max(...results.map(r => r.confidence)),
          ],
        },
        timestamp: new Date(),
      };

    } catch (error: any) {
      mlLogger.predictionError(ModelType.THREAT_CLASSIFIER, error.message, request.input);
      throw error;
    }
  }

  /**
   * Extract text from various input formats
   */
  private extractTextFromInput(input: any): string {
    if (typeof input === 'string') {
      return input;
    }
    
    if (input.description) {
      return input.description;
    }
    
    if (input.components && Array.isArray(input.components)) {
      return input.components.map((c: any) => c.description || '').join(' ');
    }
    
    return JSON.stringify(input);
  }

  /**
   * Convert text to numerical features
   */
  private textToFeatures(text: string): number[] {
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    const features = new Array(100).fill(0); // Fixed sequence length
    
    tokens.slice(0, 100).forEach((token: string, index: number) => {
      const vocabIndex = this.vocabulary.get(token) || 0;
      features[index] = vocabIndex;
    });
    
    return features;
  }

  /**
   * Process classification results
   */
  private processClassificationResults(
    probabilities: Float32Array | Int32Array | Uint8Array,
    options?: any
  ): Prediction[] {
    const threshold = options?.threshold || config.CONFIDENCE_THRESHOLD;
    const topK = options?.topK || 5;
    
    // Create predictions with probabilities
    const predictions: Prediction[] = [];
    
    Array.from(probabilities).forEach((prob, index) => {
      if (prob >= threshold && index < this.threatCategories.length) {
        predictions.push({
          label: this.threatCategories[index]!,
          confidence: prob,
          explanation: this.generateExplanation(this.threatCategories[index]!, prob),
          evidence: this.generateEvidence(this.threatCategories[index]!),
          relatedThreats: this.getRelatedThreats(this.threatCategories[index]!),
          suggestedMitigations: this.getSuggestedMitigations(this.threatCategories[index]!),
        });
      }
    });
    
    // Sort by confidence and return top K
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topK);
  }

  /**
   * Generate explanation for prediction
   */
  private generateExplanation(threatType: string, confidence: number): string {
    const explanations: Record<string, string> = {
      'Spoofing': 'Identity spoofing detected. An attacker might impersonate a legitimate user or system.',
      'Tampering': 'Data tampering risk identified. Unauthorized modification of data is possible.',
      'Repudiation': 'Repudiation threat found. Users might deny performing actions without proper logging.',
      'Information Disclosure': 'Information disclosure vulnerability. Sensitive data might be exposed.',
      'Denial of Service': 'DoS attack vector identified. System availability could be compromised.',
      'Elevation of Privilege': 'Privilege escalation risk. Unauthorized access to higher privileges possible.',
      'Injection': 'Injection vulnerability detected. Malicious code could be executed.',
      'Broken Authentication': 'Authentication weakness found. User sessions might be compromised.',
      'Sensitive Data Exposure': 'Sensitive data exposure risk. Confidential information might be leaked.',
      'Cross-Site Scripting': 'XSS vulnerability detected. Client-side code injection is possible.',
    };
    
    const confidenceLevel = confidence > 0.9 ? 'Very high' : 
                           confidence > 0.7 ? 'High' :
                           confidence > 0.5 ? 'Medium' : 'Low';
    
    return `${explanations[threatType] || 'Security threat detected.'} Confidence level: ${confidenceLevel} (${(confidence * 100).toFixed(1)}%)`;
  }

  /**
   * Generate evidence for the prediction
   */
  private generateEvidence(threatType: string): Evidence[] {
    // In a real implementation, this would analyze the input and provide specific evidence
    const evidenceMap: Record<string, Evidence[]> = {
      'Spoofing': [
        { source: 'Authentication Analysis', relevance: 0.9, description: 'Weak authentication mechanism detected' },
        { source: 'Session Management', relevance: 0.7, description: 'Session tokens not properly validated' },
      ],
      'Tampering': [
        { source: 'Data Flow Analysis', relevance: 0.85, description: 'Unprotected data transmission identified' },
        { source: 'Integrity Checks', relevance: 0.8, description: 'Missing data integrity validation' },
      ],
      'Information Disclosure': [
        { source: 'Data Classification', relevance: 0.9, description: 'Sensitive data handled without encryption' },
        { source: 'Access Control', relevance: 0.75, description: 'Insufficient access restrictions' },
      ],
      // Add more evidence for other threat types
    };
    
    return evidenceMap[threatType] || [
      { source: 'Threat Analysis', relevance: 0.7, description: 'Potential security vulnerability detected' },
    ];
  }

  /**
   * Get related threats
   */
  private getRelatedThreats(threatType: string): string[] {
    const relatedThreats: Record<string, string[]> = {
      'Spoofing': ['Broken Authentication', 'Session Hijacking', 'Identity Theft'],
      'Tampering': ['Data Integrity Violation', 'Man-in-the-Middle', 'Injection'],
      'Repudiation': ['Insufficient Logging', 'Audit Trail Manipulation'],
      'Information Disclosure': ['Sensitive Data Exposure', 'Privacy Breach', 'Data Leakage'],
      'Denial of Service': ['Resource Exhaustion', 'Rate Limiting Bypass', 'DDoS'],
      'Elevation of Privilege': ['Access Control Bypass', 'Privilege Escalation', 'Authorization Flaw'],
    };
    
    return relatedThreats[threatType] || [];
  }

  /**
   * Get suggested mitigations
   */
  private getSuggestedMitigations(threatType: string): any[] {
    // This is a simplified version - in production, this would be more comprehensive
    const mitigations: Record<string, any[]> = {
      'Spoofing': [
        {
          id: 'auth-1',
          title: 'Implement Multi-Factor Authentication',
          description: 'Add MFA to strengthen user authentication',
          category: 'Authentication',
          effectiveness: 0.9,
        },
        {
          id: 'auth-2',
          title: 'Use Strong Session Management',
          description: 'Implement secure session tokens with proper expiration',
          category: 'Session Management',
          effectiveness: 0.8,
        },
      ],
      'Tampering': [
        {
          id: 'integrity-1',
          title: 'Implement Data Integrity Checks',
          description: 'Use cryptographic hashes to verify data integrity',
          category: 'Data Protection',
          effectiveness: 0.9,
        },
        {
          id: 'integrity-2',
          title: 'Use Digital Signatures',
          description: 'Sign critical data to prevent tampering',
          category: 'Cryptography',
          effectiveness: 0.85,
        },
      ],
      // Add more mitigations for other threat types
    };
    
    return mitigations[threatType] || [];
  }

  /**
   * Assess data quality
   */
  private assessDataQuality(text: string): number {
    const factors = {
      length: text.length > 50 ? 1 : text.length / 50,
      vocabularyMatch: this.calculateVocabularyMatch(text),
      structure: text.includes('.') || text.includes(',') ? 1 : 0.5,
    };
    
    return (factors.length + factors.vocabularyMatch + factors.structure) / 3;
  }

  /**
   * Calculate vocabulary match score
   */
  private calculateVocabularyMatch(text: string): number {
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    const matches = tokens.filter((token: string) => this.vocabulary.has(token)).length;
    return Math.min(matches / tokens.length, 1);
  }

  /**
   * Save the model
   */
  async saveModel(): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }

    const modelPath = `${config.MODEL_PATH}/threat-classifier`;
    await this.model.save(`file://${modelPath}`);
    
    mlLogger.modelSaved(ModelType.THREAT_CLASSIFIER, modelPath, 0);
  }

  /**
   * Update model with new training data
   */
  async updateModel(trainingData: any[]): Promise<void> {
    // This would implement online learning or periodic retraining
    logger.info('Model update requested with', trainingData.length, 'samples');
  }

  /**
   * Get model statistics
   */
  getModelStats(): any {
    return {
      type: ModelType.THREAT_CLASSIFIER,
      loaded: this.model !== null,
      vocabularySize: this.vocabulary.size,
      categories: this.threatCategories.length,
      version: '1.0.0',
    };
  }
}
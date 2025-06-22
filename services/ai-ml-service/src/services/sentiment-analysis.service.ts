/**
 * Security Sentiment Analysis Service
 * Sentiment analysis for threat communications and security context
 */

import { EventEmitter } from 'events';
import { logger, mlLogger } from '../utils/logger';
import * as tf from '@tensorflow/tfjs-node';
import { LanguageSupportService, LanguageInfo } from '../utils/language-support';

export interface SentimentAnalysisRequest {
  request_id: string;
  text_inputs: TextInput[];
  analysis_options: AnalysisOptions;
  context?: AnalysisContext;
}

export interface TextInput {
  text_id: string;
  content: string;
  metadata: TextMetadata;
}

export interface TextMetadata {
  source: string;
  timestamp: Date;
  author?: string;
  channel: 'email' | 'chat' | 'forum' | 'social' | 'document' | 'message';
  language?: string;
  context_type: 'threat_report' | 'incident_communication' | 'internal_discussion' | 'external_communication';
}

export interface AnalysisOptions {
  analyze_emotion: boolean;
  analyze_urgency: boolean;
  analyze_threat_level: boolean;
  analyze_confidence: boolean;
  analyze_deception: boolean;
  detect_keywords: boolean;
  confidence_threshold: number;
}

export interface AnalysisContext {
  domain: 'cybersecurity' | 'general';
  baseline_context?: string;
  organizational_context?: OrganizationalContext;
}

export interface OrganizationalContext {
  organization_type: string;
  security_posture: 'low' | 'medium' | 'high';
  threat_tolerance: 'low' | 'medium' | 'high';
  communication_culture: 'formal' | 'informal' | 'mixed';
}

export interface SentimentAnalysisResponse {
  request_id: string;
  analysis_timestamp: Date;
  text_analyses: TextAnalysis[];
  aggregate_analysis: AggregateAnalysis;
  insights: AnalysisInsights;
}

export interface TextAnalysis {
  text_id: string;
  sentiment_scores: SentimentScores;
  emotion_analysis: EmotionAnalysis;
  urgency_analysis: UrgencyAnalysis;
  threat_perception: ThreatPerception;
  confidence_analysis: ConfidenceAnalysis;
  deception_indicators: DeceptionIndicators;
  keyword_analysis: KeywordAnalysis;
  contextual_factors: ContextualFactors;
}

export interface SentimentScores {
  overall_sentiment: 'negative' | 'neutral' | 'positive';
  polarity_score: number; // -1 to 1
  intensity: number; // 0 to 1
  confidence: number;
  sub_sentiments: SubSentiment[];
}

export interface SubSentiment {
  aspect: string;
  sentiment: 'negative' | 'neutral' | 'positive';
  score: number;
  confidence: number;
  text_span: TextSpan;
}

export interface TextSpan {
  start_index: number;
  end_index: number;
  text: string;
}

export interface EmotionAnalysis {
  primary_emotion: Emotion;
  secondary_emotions: Emotion[];
  emotional_intensity: number;
  emotional_stability: number;
  confidence: number;
}

export interface Emotion {
  emotion_type: 'anger' | 'fear' | 'sadness' | 'joy' | 'surprise' | 'disgust' | 'trust' | 'anticipation';
  intensity: number;
  confidence: number;
  indicators: string[];
}

export interface UrgencyAnalysis {
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
  urgency_score: number;
  urgency_indicators: UrgencyIndicator[];
  time_sensitivity: TimeSensitivity;
  confidence: number;
}

export interface UrgencyIndicator {
  indicator_type: 'temporal' | 'linguistic' | 'contextual';
  indicator_value: string;
  weight: number;
  confidence: number;
}

export interface TimeSensitivity {
  immediate_action_required: boolean;
  deadline_mentioned: boolean;
  time_pressure_level: number;
  estimated_response_window: string;
}

export interface ThreatPerception {
  perceived_threat_level: 'low' | 'medium' | 'high' | 'critical';
  threat_certainty: number;
  threat_imminence: number;
  threat_scope: ThreatScope;
  threat_indicators: ThreatIndicator[];
  confidence: number;
}

export interface ThreatScope {
  personal: boolean;
  organizational: boolean;
  sectoral: boolean;
  national: boolean;
  global: boolean;
}

export interface ThreatIndicator {
  indicator_text: string;
  indicator_type: 'direct' | 'implied' | 'contextual';
  severity_contribution: number;
  confidence: number;
}

export interface ConfidenceAnalysis {
  speaker_confidence: number;
  information_certainty: number;
  assertion_strength: number;
  qualification_level: number;
  confidence_indicators: ConfidenceIndicator[];
}

export interface ConfidenceIndicator {
  indicator_type: 'linguistic' | 'modal' | 'hedging' | 'amplification';
  indicator_text: string;
  confidence_effect: 'increase' | 'decrease' | 'neutral';
  magnitude: number;
}

export interface DeceptionIndicators {
  deception_likelihood: number;
  deception_signals: DeceptionSignal[];
  linguistic_anomalies: LinguisticAnomaly[];
  consistency_analysis: ConsistencyAnalysis;
  confidence: number;
}

export interface DeceptionSignal {
  signal_type: 'evasion' | 'contradiction' | 'over_specification' | 'deflection';
  signal_text: string;
  strength: number;
  confidence: number;
}

export interface LinguisticAnomaly {
  anomaly_type: 'unusual_phrasing' | 'complexity_mismatch' | 'register_shift' | 'temporal_inconsistency';
  description: string;
  severity: number;
}

export interface ConsistencyAnalysis {
  internal_consistency: number;
  factual_consistency: number;
  temporal_consistency: number;
  logical_consistency: number;
}

export interface KeywordAnalysis {
  security_keywords: SecurityKeyword[];
  emotional_keywords: EmotionalKeyword[];
  action_keywords: ActionKeyword[];
  temporal_keywords: TemporalKeyword[];
  intensity_modifiers: IntensityModifier[];
}

export interface SecurityKeyword {
  keyword: string;
  frequency: number;
  context: string[];
  sentiment_impact: number;
  threat_relevance: number;
}

export interface EmotionalKeyword {
  keyword: string;
  emotion_type: string;
  intensity: number;
  frequency: number;
  context: string[];
}

export interface ActionKeyword {
  keyword: string;
  action_type: 'defensive' | 'offensive' | 'investigative' | 'administrative';
  urgency_impact: number;
  frequency: number;
}

export interface TemporalKeyword {
  keyword: string;
  temporal_reference: 'past' | 'present' | 'future' | 'urgent';
  time_pressure: number;
  frequency: number;
}

export interface IntensityModifier {
  modifier: string;
  modifier_type: 'amplifier' | 'diminisher' | 'negation';
  impact_factor: number;
  frequency: number;
}

export interface ContextualFactors {
  communication_formality: number;
  technical_complexity: number;
  domain_specificity: number;
  cultural_indicators: CulturalIndicator[];
  situational_context: SituationalContext;
}

export interface CulturalIndicator {
  indicator_type: 'linguistic' | 'cultural' | 'organizational';
  indicator_value: string;
  cultural_context: string;
  relevance: number;
}

export interface SituationalContext {
  crisis_indicators: boolean;
  routine_communication: boolean;
  escalation_context: boolean;
  collaborative_context: boolean;
  conflict_indicators: boolean;
}

export interface AggregateAnalysis {
  overall_sentiment_distribution: SentimentDistribution;
  emotion_trends: EmotionTrend[];
  urgency_patterns: UrgencyPattern[];
  threat_assessment: AggregateThreatAssessment;
  communication_patterns: CommunicationPattern[];
}

export interface SentimentDistribution {
  positive_percentage: number;
  neutral_percentage: number;
  negative_percentage: number;
  average_polarity: number;
  sentiment_variance: number;
}

export interface EmotionTrend {
  emotion_type: string;
  frequency: number;
  average_intensity: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
}

export interface UrgencyPattern {
  urgency_level: string;
  frequency: number;
  typical_indicators: string[];
  response_requirements: string[];
}

export interface AggregateThreatAssessment {
  overall_threat_level: 'low' | 'medium' | 'high' | 'critical';
  threat_consensus: number;
  threat_escalation_indicators: string[];
  threat_mitigation_indicators: string[];
}

export interface CommunicationPattern {
  pattern_type: 'escalation' | 'de_escalation' | 'information_seeking' | 'decision_making';
  frequency: number;
  typical_characteristics: string[];
  sentiment_correlation: number;
}

export interface AnalysisInsights {
  key_findings: string[];
  sentiment_alerts: SentimentAlert[];
  communication_recommendations: string[];
  risk_indicators: RiskIndicator[];
  confidence_assessment: string;
}

export interface SentimentAlert {
  alert_type: 'high_negativity' | 'deception_risk' | 'urgency_spike' | 'threat_escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_texts: string[];
  recommendations: string[];
}

export interface RiskIndicator {
  risk_type: 'communication' | 'operational' | 'security' | 'compliance';
  risk_level: number;
  description: string;
  mitigation_suggestions: string[];
}

export class SentimentAnalysisService extends EventEmitter {
  private sentimentModel?: tf.LayersModel;
  private emotionModel?: tf.LayersModel;
  private urgencyModel?: tf.LayersModel;
  private vocabularyMap: Map<string, number> = new Map();
  private emotionVocabulary: Map<string, number> = new Map();
  private languageSupport: LanguageSupportService;
  private isInitialized: boolean = false;

  // Predefined lexicons
  private readonly securityLexicon = new Map<string, number>([
    ['threat', 0.8], ['attack', 0.9], ['breach', 0.9], ['vulnerability', 0.7],
    ['secure', -0.6], ['protect', -0.5], ['safe', -0.7], ['defend', -0.4],
    ['critical', 0.9], ['urgent', 0.8], ['emergency', 0.9], ['immediate', 0.8]
  ]);

  private readonly emotionLexicon = new Map<string, { emotion: string; intensity: number }>([
    ['angry', { emotion: 'anger', intensity: 0.8 }],
    ['frustrated', { emotion: 'anger', intensity: 0.6 }],
    ['worried', { emotion: 'fear', intensity: 0.7 }],
    ['concerned', { emotion: 'fear', intensity: 0.5 }],
    ['confident', { emotion: 'trust', intensity: 0.7 }],
    ['anxious', { emotion: 'fear', intensity: 0.8 }]
  ]);

  constructor() {
    super();
    this.languageSupport = LanguageSupportService.getInstance();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      logger.info('Initializing Sentiment Analysis Service...');
      
      await this.initializeModels();
      await this.loadVocabularies();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('Sentiment Analysis Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize sentiment analysis service:', error);
      throw error;
    }
  }

  private async initializeModels(): Promise<void> {
    // Sentiment analysis model
    this.sentimentModel = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: 10000, outputDim: 64, inputLength: 100 }),
        tf.layers.bidirectional({
          layer: tf.layers.lstm({ units: 32, returnSequences: false })
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' }) // negative, neutral, positive
      ]
    });

    // Emotion classification model
    this.emotionModel = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: 5000, outputDim: 64, inputLength: 100 }),
        tf.layers.lstm({ units: 32 }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'softmax' }) // 8 basic emotions
      ]
    });

    // Urgency detection model
    this.urgencyModel = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: 5000, outputDim: 32, inputLength: 50 }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 4, activation: 'softmax' }) // low, medium, high, critical
      ]
    });

    // Compile models
    this.sentimentModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.emotionModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.urgencyModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    logger.info('Sentiment analysis models initialized successfully');
  }

  private async loadVocabularies(): Promise<void> {
    // Load sentiment vocabulary
    const sentimentWords = [
      'good', 'bad', 'excellent', 'terrible', 'amazing', 'awful',
      'threat', 'safe', 'danger', 'secure', 'risk', 'protect'
    ];

    sentimentWords.forEach((word, index) => {
      this.vocabularyMap.set(word.toLowerCase(), index + 1);
    });

    // Load emotion vocabulary
    const emotionWords = [
      'anger', 'fear', 'joy', 'sadness', 'surprise', 'disgust', 'trust', 'anticipation'
    ];

    emotionWords.forEach((word, index) => {
      this.emotionVocabulary.set(word.toLowerCase(), index + 1);
    });

    logger.info('Sentiment vocabularies loaded successfully');
  }

  async analyzeSentimentDetailed(request: SentimentAnalysisRequest): Promise<SentimentAnalysisResponse> {
    if (!this.isInitialized) {
      throw new Error('Sentiment analysis service not initialized');
    }

    logger.info(`Processing sentiment analysis request: ${request.request_id}`);
    const startTime = Date.now();

    try {
      const textAnalyses: TextAnalysis[] = [];

      // Analyze each text input with language detection and processing
      for (const textInput of request.text_inputs) {
        // Detect language if not provided
        const detectedLanguage = textInput.metadata.language || 
          (await this.languageSupport.detectLanguage(textInput.content)).code;
        
        logger.info(`Processing sentiment analysis for text in language: ${detectedLanguage}`);
        
        // Normalize text for the detected language
        const normalizedText = this.languageSupport.normalizeTextForLanguage(
          textInput.content, 
          detectedLanguage
        );
        
        // Create enhanced text input with language information
        const enhancedTextInput: TextInput = {
          ...textInput,
          content: normalizedText,
          metadata: {
            ...textInput.metadata,
            language: detectedLanguage
          }
        };
        
        const analysis = await this.analyzeText(enhancedTextInput, request.analysis_options, request.context);
        textAnalyses.push(analysis);
      }

      // Generate aggregate analysis
      const aggregateAnalysis = await this.generateAggregateAnalysis(textAnalyses);

      // Generate insights
      const insights = await this.generateInsights(textAnalyses, aggregateAnalysis);

      const response: SentimentAnalysisResponse = {
        request_id: request.request_id,
        analysis_timestamp: new Date(),
        text_analyses: textAnalyses,
        aggregate_analysis: aggregateAnalysis,
        insights
      };

      this.emit('sentiment_analysis_completed', response);
      logger.info(`Sentiment analysis completed in ${Date.now() - startTime}ms`);

      return response;

    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      throw error;
    }
  }

  private async analyzeText(
    textInput: TextInput,
    options: AnalysisOptions,
    context?: AnalysisContext
  ): Promise<TextAnalysis> {
    const languageCode = textInput.metadata.language || 'en';
    
    const analysis: TextAnalysis = {
      text_id: textInput.text_id,
      sentiment_scores: await this.analyzeSentimentScores(textInput.content, languageCode),
      emotion_analysis: await this.analyzeEmotion(textInput.content, languageCode),
      urgency_analysis: await this.analyzeUrgency(textInput.content, languageCode),
      threat_perception: await this.analyzeThreatPerception(textInput.content, languageCode),
      confidence_analysis: await this.analyzeConfidence(textInput.content, languageCode),
      deception_indicators: await this.analyzeDeception(textInput.content, languageCode),
      keyword_analysis: await this.analyzeKeywords(textInput.content, languageCode),
      contextual_factors: await this.analyzeContextualFactors(textInput, context)
    };

    return analysis;
  }

  private async analyzeSentimentScores(text: string, languageCode: string = 'en'): Promise<SentimentScores> {
    // Multi-language lexicon-based approach
    const lexiconScore = this.calculateMultiLanguageLexiconSentiment(text, languageCode);
    
    // Translate to English for model prediction if needed
    let processedText = text;
    if (languageCode !== 'en') {
      const translationResult = await this.languageSupport.translateText({
        text: text,
        sourceLanguage: languageCode,
        targetLanguage: 'en'
      });
      processedText = translationResult.translatedText;
    }
    
    // Simple rule-based sentiment for demonstration
    let overallSentiment: 'negative' | 'neutral' | 'positive';
    if (lexiconScore > 0.1) overallSentiment = 'positive';
    else if (lexiconScore < -0.1) overallSentiment = 'negative';
    else overallSentiment = 'neutral';

    return {
      overall_sentiment: overallSentiment,
      polarity_score: lexiconScore,
      intensity: Math.abs(lexiconScore),
      confidence: languageCode === 'en' ? 0.8 : 0.7, // Lower confidence for translated text
      sub_sentiments: await this.extractSubSentiments(processedText, languageCode)
    };
  }

  private calculateLexiconSentiment(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let totalScore = 0;
    let wordCount = 0;

    for (const word of words) {
      if (this.securityLexicon.has(word)) {
        totalScore += this.securityLexicon.get(word)!;
        wordCount++;
      }
    }

    return wordCount > 0 ? totalScore / wordCount : 0;
  }

  private async extractSubSentiments(text: string): Promise<SubSentiment[]> {
    const sentences = text.split(/[.!?]+/);
    const subSentiments: SubSentiment[] = [];

    let currentIndex = 0;
    for (const sentence of sentences) {
      if (sentence.trim().length > 10) {
        const sentimentScore = this.calculateLexiconSentiment(sentence);
        let sentiment: 'negative' | 'neutral' | 'positive';
        
        if (sentimentScore > 0.1) sentiment = 'positive';
        else if (sentimentScore < -0.1) sentiment = 'negative';
        else sentiment = 'neutral';

        subSentiments.push({
          aspect: 'sentence',
          sentiment,
          score: sentimentScore,
          confidence: 0.7,
          text_span: {
            start_index: currentIndex,
            end_index: currentIndex + sentence.length,
            text: sentence.trim()
          }
        });
      }
      currentIndex += sentence.length + 1;
    }

    return subSentiments;
  }

  private async analyzeEmotion(text: string): Promise<EmotionAnalysis> {
    const emotionScores = new Map<string, number>();
    const words = text.toLowerCase().split(/\s+/);

    // Calculate emotion scores based on lexicon
    for (const word of words) {
      if (this.emotionLexicon.has(word)) {
        const emotionData = this.emotionLexicon.get(word)!;
        const currentScore = emotionScores.get(emotionData.emotion) || 0;
        emotionScores.set(emotionData.emotion, currentScore + emotionData.intensity);
      }
    }

    // Find primary emotion
    let primaryEmotion: Emotion = {
      emotion_type: 'trust',
      intensity: 0.5,
      confidence: 0.6,
      indicators: []
    };

    if (emotionScores.size > 0) {
      const sortedEmotions = Array.from(emotionScores.entries())
        .sort(([,a], [,b]) => b - a);
      
      const [emotionType, intensity] = sortedEmotions[0];
      primaryEmotion = {
        emotion_type: emotionType as any,
        intensity: Math.min(1.0, intensity / words.length * 10),
        confidence: 0.8,
        indicators: words.filter(word => {
          const emotionData = this.emotionLexicon.get(word);
          return emotionData && emotionData.emotion === emotionType;
        })
      };
    }

    return {
      primary_emotion: primaryEmotion,
      secondary_emotions: [],
      emotional_intensity: primaryEmotion.intensity,
      emotional_stability: 0.7,
      confidence: primaryEmotion.confidence
    };
  }

  private async analyzeUrgency(text: string): Promise<UrgencyAnalysis> {
    const urgencyKeywords = [
      { keyword: 'urgent', weight: 0.9, type: 'linguistic' as const },
      { keyword: 'immediate', weight: 0.8, type: 'linguistic' as const },
      { keyword: 'asap', weight: 0.7, type: 'linguistic' as const },
      { keyword: 'emergency', weight: 1.0, type: 'linguistic' as const },
      { keyword: 'critical', weight: 0.9, type: 'linguistic' as const },
      { keyword: 'now', weight: 0.6, type: 'temporal' as const }
    ];

    let urgencyScore = 0;
    const indicators: UrgencyIndicator[] = [];

    for (const { keyword, weight, type } of urgencyKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        urgencyScore += weight;
        indicators.push({
          indicator_type: type,
          indicator_value: keyword,
          weight,
          confidence: 0.8
        });
      }
    }

    // Normalize urgency score
    urgencyScore = Math.min(1.0, urgencyScore / 2);

    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    if (urgencyScore >= 0.8) urgencyLevel = 'critical';
    else if (urgencyScore >= 0.6) urgencyLevel = 'high';
    else if (urgencyScore >= 0.3) urgencyLevel = 'medium';
    else urgencyLevel = 'low';

    return {
      urgency_level: urgencyLevel,
      urgency_score: urgencyScore,
      urgency_indicators: indicators,
      time_sensitivity: {
        immediate_action_required: urgencyScore > 0.7,
        deadline_mentioned: /deadline|due|by \d+/.test(text.toLowerCase()),
        time_pressure_level: urgencyScore,
        estimated_response_window: urgencyScore > 0.7 ? 'immediate' : 'normal'
      },
      confidence: 0.8
    };
  }

  private async analyzeThreatPerception(text: string): Promise<ThreatPerception> {
    const threatKeywords = [
      'threat', 'attack', 'breach', 'hack', 'malware', 'virus',
      'compromise', 'exploit', 'vulnerability', 'risk'
    ];

    let threatScore = 0;
    const indicators: ThreatIndicator[] = [];

    for (const keyword of threatKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        threatScore += matches.length * 0.2;
        indicators.push({
          indicator_text: keyword,
          indicator_type: 'direct',
          severity_contribution: 0.2,
          confidence: 0.8
        });
      }
    }

    threatScore = Math.min(1.0, threatScore);

    let threatLevel: 'low' | 'medium' | 'high' | 'critical';
    if (threatScore >= 0.8) threatLevel = 'critical';
    else if (threatScore >= 0.6) threatLevel = 'high';
    else if (threatScore >= 0.3) threatLevel = 'medium';
    else threatLevel = 'low';

    return {
      perceived_threat_level: threatLevel,
      threat_certainty: threatScore,
      threat_imminence: threatScore * 0.8,
      threat_scope: {
        personal: text.includes('I') || text.includes('my'),
        organizational: text.includes('company') || text.includes('organization'),
        sectoral: text.includes('industry') || text.includes('sector'),
        national: text.includes('country') || text.includes('national'),
        global: text.includes('global') || text.includes('worldwide')
      },
      threat_indicators: indicators,
      confidence: 0.7
    };
  }

  private async analyzeConfidence(text: string): Promise<ConfidenceAnalysis> {
    const hedgingWords = ['maybe', 'perhaps', 'possibly', 'might', 'could'];
    const amplifyingWords = ['definitely', 'certainly', 'absolutely', 'clearly'];

    let confidenceScore = 0.5; // baseline
    const indicators: ConfidenceIndicator[] = [];

    // Check for hedging (reduces confidence)
    for (const hedge of hedgingWords) {
      if (text.toLowerCase().includes(hedge)) {
        confidenceScore -= 0.1;
        indicators.push({
          indicator_type: 'hedging',
          indicator_text: hedge,
          confidence_effect: 'decrease',
          magnitude: 0.1
        });
      }
    }

    // Check for amplification (increases confidence)
    for (const amplifier of amplifyingWords) {
      if (text.toLowerCase().includes(amplifier)) {
        confidenceScore += 0.1;
        indicators.push({
          indicator_type: 'amplification',
          indicator_text: amplifier,
          confidence_effect: 'increase',
          magnitude: 0.1
        });
      }
    }

    confidenceScore = Math.max(0, Math.min(1, confidenceScore));

    return {
      speaker_confidence: confidenceScore,
      information_certainty: confidenceScore,
      assertion_strength: confidenceScore,
      qualification_level: 1 - confidenceScore,
      confidence_indicators: indicators
    };
  }

  private async analyzeDeception(text: string): Promise<DeceptionIndicators> {
    // Simple deception detection heuristics
    const deceptionSignals: DeceptionSignal[] = [];
    let deceptionScore = 0;

    // Check for evasive language
    const evasivePatterns = ['I don\'t recall', 'to the best of my knowledge', 'I believe'];
    for (const pattern of evasivePatterns) {
      if (text.toLowerCase().includes(pattern.toLowerCase())) {
        deceptionScore += 0.2;
        deceptionSignals.push({
          signal_type: 'evasion',
          signal_text: pattern,
          strength: 0.2,
          confidence: 0.6
        });
      }
    }

    // Check for over-specification
    const sentenceCount = text.split(/[.!?]+/).length;
    const avgWordsPerSentence = text.split(/\s+/).length / sentenceCount;
    if (avgWordsPerSentence > 25) {
      deceptionScore += 0.1;
      deceptionSignals.push({
        signal_type: 'over_specification',
        signal_text: 'Unusually detailed response',
        strength: 0.1,
        confidence: 0.5
      });
    }

    return {
      deception_likelihood: Math.min(1.0, deceptionScore),
      deception_signals: deceptionSignals,
      linguistic_anomalies: [],
      consistency_analysis: {
        internal_consistency: 0.8,
        factual_consistency: 0.8,
        temporal_consistency: 0.8,
        logical_consistency: 0.8
      },
      confidence: 0.6
    };
  }

  private async analyzeKeywords(text: string): Promise<KeywordAnalysis> {
    const words = text.toLowerCase().split(/\s+/);
    
    const securityKeywords: SecurityKeyword[] = [];
    const emotionalKeywords: EmotionalKeyword[] = [];
    const actionKeywords: ActionKeyword[] = [];
    const temporalKeywords: TemporalKeyword[] = [];
    const intensityModifiers: IntensityModifier[] = [];

    // Analyze security keywords
    for (const [keyword, score] of this.securityLexicon.entries()) {
      const frequency = words.filter(word => word === keyword).length;
      if (frequency > 0) {
        securityKeywords.push({
          keyword,
          frequency,
          context: [text.substring(0, 100)], // simplified
          sentiment_impact: score,
          threat_relevance: Math.abs(score)
        });
      }
    }

    // Analyze emotional keywords
    for (const [keyword, emotionData] of this.emotionLexicon.entries()) {
      const frequency = words.filter(word => word === keyword).length;
      if (frequency > 0) {
        emotionalKeywords.push({
          keyword,
          emotion_type: emotionData.emotion,
          intensity: emotionData.intensity,
          frequency,
          context: [text.substring(0, 100)]
        });
      }
    }

    // Action keywords
    const actionWords = ['attack', 'defend', 'investigate', 'block', 'allow'];
    for (const action of actionWords) {
      const frequency = words.filter(word => word === action).length;
      if (frequency > 0) {
        actionKeywords.push({
          keyword: action,
          action_type: action === 'attack' ? 'offensive' : 'defensive',
          urgency_impact: 0.5,
          frequency
        });
      }
    }

    return {
      security_keywords: securityKeywords,
      emotional_keywords: emotionalKeywords,
      action_keywords: actionKeywords,
      temporal_keywords: temporalKeywords,
      intensity_modifiers: intensityModifiers
    };
  }

  private async analyzeContextualFactors(
    textInput: TextInput,
    context?: AnalysisContext
  ): Promise<ContextualFactors> {
    const text = textInput.content;
    
    return {
      communication_formality: this.assessFormality(text),
      technical_complexity: this.assessTechnicalComplexity(text),
      domain_specificity: this.assessDomainSpecificity(text),
      cultural_indicators: [],
      situational_context: {
        crisis_indicators: text.toLowerCase().includes('crisis') || text.toLowerCase().includes('emergency'),
        routine_communication: textInput.metadata.context_type === 'internal_discussion',
        escalation_context: text.toLowerCase().includes('escalate'),
        collaborative_context: text.toLowerCase().includes('team') || text.toLowerCase().includes('together'),
        conflict_indicators: text.toLowerCase().includes('disagree') || text.toLowerCase().includes('conflict')
      }
    };
  }

  private assessFormality(text: string): number {
    const formalWords = ['therefore', 'furthermore', 'consequently', 'respective'];
    const informalWords = ['gonna', 'wanna', 'yeah', 'ok'];
    
    const formalCount = formalWords.filter(word => text.toLowerCase().includes(word)).length;
    const informalCount = informalWords.filter(word => text.toLowerCase().includes(word)).length;
    
    return (formalCount - informalCount + 2) / 4; // normalize to 0-1
  }

  private assessTechnicalComplexity(text: string): number {
    const technicalTerms = ['algorithm', 'protocol', 'encryption', 'hash', 'vulnerability'];
    const matches = technicalTerms.filter(term => text.toLowerCase().includes(term)).length;
    return Math.min(1.0, matches / 3);
  }

  private assessDomainSpecificity(text: string): number {
    const securityTerms = Array.from(this.securityLexicon.keys());
    const matches = securityTerms.filter(term => text.toLowerCase().includes(term)).length;
    return Math.min(1.0, matches / 5);
  }

  private async generateAggregateAnalysis(analyses: TextAnalysis[]): Promise<AggregateAnalysis> {
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    let totalPolarity = 0;

    for (const analysis of analyses) {
      sentimentCounts[analysis.sentiment_scores.overall_sentiment]++;
      totalPolarity += analysis.sentiment_scores.polarity_score;
    }

    const total = analyses.length;
    
    return {
      overall_sentiment_distribution: {
        positive_percentage: (sentimentCounts.positive / total) * 100,
        neutral_percentage: (sentimentCounts.neutral / total) * 100,
        negative_percentage: (sentimentCounts.negative / total) * 100,
        average_polarity: totalPolarity / total,
        sentiment_variance: 0.1 // simplified
      },
      emotion_trends: [],
      urgency_patterns: [],
      threat_assessment: {
        overall_threat_level: 'medium',
        threat_consensus: 0.7,
        threat_escalation_indicators: [],
        threat_mitigation_indicators: []
      },
      communication_patterns: []
    };
  }

  private async generateInsights(
    analyses: TextAnalysis[],
    aggregate: AggregateAnalysis
  ): Promise<AnalysisInsights> {
    const alerts: SentimentAlert[] = [];
    
    // Check for high negativity
    if (aggregate.overall_sentiment_distribution.negative_percentage > 70) {
      alerts.push({
        alert_type: 'high_negativity',
        severity: 'high',
        description: 'High percentage of negative sentiment detected',
        affected_texts: analyses.filter(a => a.sentiment_scores.overall_sentiment === 'negative')
          .map(a => a.text_id),
        recommendations: ['Review communication tone', 'Address concerns proactively']
      });
    }

    return {
      key_findings: [
        `Average sentiment polarity: ${aggregate.overall_sentiment_distribution.average_polarity.toFixed(2)}`,
        `Negative sentiment: ${aggregate.overall_sentiment_distribution.negative_percentage.toFixed(1)}%`
      ],
      sentiment_alerts: alerts,
      communication_recommendations: [
        'Monitor sentiment trends over time',
        'Address negative sentiment sources',
        'Improve communication clarity'
      ],
      risk_indicators: [],
      confidence_assessment: 'Medium confidence based on lexicon-based analysis'
    };
  }

  /**
   * Multi-language sentiment analysis methods
   */
  private calculateMultiLanguageLexiconSentiment(text: string, languageCode: string): number {
    // Get localized terms for sentiment analysis
    const localizedTerms = this.languageSupport.getLocalizedTerms(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    let totalScore = 0;
    let wordCount = 0;

    // Use security lexicon (English)
    for (const word of words) {
      if (this.securityLexicon.has(word)) {
        totalScore += this.securityLexicon.get(word)!;
        wordCount++;
      }
      
      // Check localized security terms
      for (const [englishTerm, localizedTerm] of Object.entries(localizedTerms)) {
        if (localizedTerm && word === localizedTerm.toLowerCase()) {
          // Map to English sentiment value
          if (this.securityLexicon.has(englishTerm)) {
            totalScore += this.securityLexicon.get(englishTerm)!;
            wordCount++;
          }
          break;
        }
      }
    }

    // Add language-specific sentiment patterns
    totalScore += this.calculateLanguageSpecificSentiment(text, languageCode);

    return wordCount > 0 ? totalScore / wordCount : 0;
  }
  
  private calculateLanguageSpecificSentiment(text: string, languageCode: string): number {
    let score = 0;
    
    // Language-specific sentiment patterns
    const languagePatterns: { [key: string]: { [pattern: string]: number } } = {
      'en': {
        'very': 0.2,
        'extremely': 0.3,
        'not': -0.5,
        'never': -0.3
      },
      'es': {
        'muy': 0.2,
        'extremadamente': 0.3,
        'no': -0.5,
        'nunca': -0.3
      },
      'fr': {
        'très': 0.2,
        'extrêmement': 0.3,
        'ne': -0.5,
        'jamais': -0.3
      },
      'de': {
        'sehr': 0.2,
        'extrem': 0.3,
        'nicht': -0.5,
        'nie': -0.3
      },
      'zh': {
        '非常': 0.2,
        '极其': 0.3,
        '不': -0.5,
        '从不': -0.3
      }
    };
    
    const patterns = languagePatterns[languageCode] || languagePatterns['en'];
    const words = text.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (patterns[word]) {
        score += patterns[word];
      }
    }
    
    return score;
  }
  
  private async extractSubSentiments(text: string, languageCode: string = 'en'): Promise<SubSentiment[]> {
    const subSentiments: SubSentiment[] = [];
    const sentences = text.split(/[.!?]+/);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence.length === 0) continue;
      
      const sentimentScore = this.calculateMultiLanguageLexiconSentiment(sentence, languageCode);
      
      let sentiment: 'negative' | 'neutral' | 'positive';
      if (sentimentScore > 0.1) sentiment = 'positive';
      else if (sentimentScore < -0.1) sentiment = 'negative';
      else sentiment = 'neutral';
      
      const startIndex = text.indexOf(sentence);
      
      subSentiments.push({
        aspect: `sentence_${i + 1}`,
        sentiment,
        score: sentimentScore,
        confidence: 0.7,
        text_span: {
          start_index: startIndex,
          end_index: startIndex + sentence.length,
          text: sentence
        }
      });
    }
    
    return subSentiments;
  }
  
  private async analyzeEmotion(text: string, languageCode: string = 'en'): Promise<EmotionAnalysis> {
    // Multi-language emotion keywords
    const emotionKeywords = this.getLanguageSpecificEmotionKeywords(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    const emotions: { [key: string]: number } = {};
    
    for (const word of words) {
      for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
        if (keywords.includes(word)) {
          emotions[emotion] = (emotions[emotion] || 0) + 1;
        }
      }
    }
    
    const sortedEmotions = Object.entries(emotions)
      .sort(([,a], [,b]) => b - a)
      .map(([emotion, count]): Emotion => ({
        emotion_type: emotion,
        confidence: Math.min(0.9, count * 0.2),
        intensity: Math.min(1.0, count * 0.3),
        indicators: words.filter(word => emotionKeywords[emotion]?.includes(word))
      }));
    
    return {
      primary_emotion: sortedEmotions[0] || { emotion_type: 'neutral', confidence: 0.5, intensity: 0.1, indicators: [] },
      secondary_emotions: sortedEmotions.slice(1, 3),
      emotional_intensity: sortedEmotions.length > 0 ? sortedEmotions[0].intensity : 0.1,
      emotion_distribution: emotions
    };
  }
  
  private async analyzeUrgency(text: string, languageCode: string = 'en'): Promise<UrgencyAnalysis> {
    const urgencyKeywords = this.getLanguageSpecificUrgencyKeywords(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    let urgencyScore = 0;
    const indicators: string[] = [];
    
    for (const word of words) {
      for (const [level, keywords] of Object.entries(urgencyKeywords)) {
        if (keywords.includes(word)) {
          const levelScore = level === 'critical' ? 1.0 : level === 'high' ? 0.7 : level === 'medium' ? 0.4 : 0.2;
          urgencyScore = Math.max(urgencyScore, levelScore);
          indicators.push(word);
        }
      }
    }
    
    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    if (urgencyScore >= 0.8) urgencyLevel = 'critical';
    else if (urgencyScore >= 0.6) urgencyLevel = 'high';
    else if (urgencyScore >= 0.3) urgencyLevel = 'medium';
    else urgencyLevel = 'low';
    
    return {
      urgency_level: urgencyLevel,
      urgency_score: urgencyScore,
      urgency_confidence: 0.8,
      urgency_indicators: indicators,
      time_sensitivity: urgencyScore > 0.7 ? 'immediate' : urgencyScore > 0.4 ? 'soon' : 'normal',
      response_timeline: urgencyScore > 0.7 ? '< 1 hour' : urgencyScore > 0.4 ? '< 24 hours' : '< 1 week'
    };
  }
  
  private async analyzeThreatPerception(text: string, languageCode: string = 'en'): Promise<ThreatPerception> {
    const threatKeywords = this.getLanguageSpecificThreatKeywords(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    let threatScore = 0;
    const indicators: string[] = [];
    
    for (const word of words) {
      if (threatKeywords.includes(word)) {
        threatScore += 0.2;
        indicators.push(word);
      }
    }
    
    threatScore = Math.min(1.0, threatScore);
    
    let threatLevel: 'low' | 'medium' | 'high' | 'critical';
    if (threatScore >= 0.8) threatLevel = 'critical';
    else if (threatScore >= 0.6) threatLevel = 'high';
    else if (threatScore >= 0.3) threatLevel = 'medium';
    else threatLevel = 'low';
    
    return {
      perceived_threat_level: threatLevel,
      threat_confidence: 0.7,
      threat_indicators: indicators,
      severity_assessment: threatScore,
      impact_prediction: threatScore > 0.6 ? 'high' : threatScore > 0.3 ? 'medium' : 'low',
      likelihood_assessment: threatScore > 0.7 ? 'high' : threatScore > 0.4 ? 'medium' : 'low'
    };
  }
  
  private async analyzeConfidence(text: string, languageCode: string = 'en'): Promise<ConfidenceAnalysis> {
    const confidenceKeywords = this.getLanguageSpecificConfidenceKeywords(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    let confidenceScore = 0.5; // Default neutral confidence
    const indicators: string[] = [];
    
    for (const word of words) {
      for (const [level, keywords] of Object.entries(confidenceKeywords)) {
        if (keywords.includes(word)) {
          const levelScore = level === 'high' ? 0.9 : level === 'medium' ? 0.6 : 0.3;
          confidenceScore = (confidenceScore + levelScore) / 2;
          indicators.push(word);
        }
      }
    }
    
    return {
      confidence_level: confidenceScore > 0.7 ? 'high' : confidenceScore > 0.4 ? 'medium' : 'low',
      confidence_score: confidenceScore,
      confidence_indicators: indicators,
      certainty_markers: indicators.filter(i => ['certainly', 'definitely', 'absolutely'].includes(i)),
      uncertainty_markers: indicators.filter(i => ['maybe', 'possibly', 'uncertain'].includes(i)),
      assertion_strength: confidenceScore
    };
  }
  
  private async analyzeDeception(text: string, languageCode: string = 'en'): Promise<DeceptionIndicators> {
    const deceptionKeywords = this.getLanguageSpecificDeceptionKeywords(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    let deceptionScore = 0;
    const indicators: string[] = [];
    
    for (const word of words) {
      if (deceptionKeywords.includes(word)) {
        deceptionScore += 0.1;
        indicators.push(word);
      }
    }
    
    // Check for contradiction patterns
    const contradictions = this.detectContradictions(text, languageCode);
    deceptionScore += contradictions.length * 0.2;
    
    return {
      deception_likelihood: deceptionScore > 0.5 ? 'high' : deceptionScore > 0.2 ? 'medium' : 'low',
      deception_score: Math.min(1.0, deceptionScore),
      deception_confidence: 0.6,
      linguistic_indicators: indicators,
      contradiction_patterns: contradictions,
      truthfulness_assessment: deceptionScore < 0.3 ? 'likely_truthful' : deceptionScore < 0.6 ? 'uncertain' : 'likely_deceptive'
    };
  }
  
  private async analyzeKeywords(text: string, languageCode: string = 'en'): Promise<KeywordAnalysis> {
    const localizedTerms = this.languageSupport.getLocalizedTerms(languageCode);
    const words = text.toLowerCase().split(/\s+/);
    
    const securityKeywords: SecurityKeyword[] = [];
    const emotionalKeywords: EmotionalKeyword[] = [];
    const actionKeywords: ActionKeyword[] = [];
    const temporalKeywords: TemporalKeyword[] = [];
    const intensityModifiers: IntensityModifier[] = [];
    
    // Analyze security keywords (both English and localized)
    for (const [englishTerm, localizedTerm] of Object.entries(localizedTerms)) {
      const frequency = words.filter(w => w === localizedTerm?.toLowerCase()).length;
      if (frequency > 0) {
        securityKeywords.push({
          keyword: localizedTerm || englishTerm,
          frequency,
          context: [text.substring(0, 100)],
          sentiment_impact: this.securityLexicon.get(englishTerm) || 0,
          threat_relevance: englishTerm.includes('threat') || englishTerm.includes('attack') ? 0.9 : 0.5
        });
      }
    }
    
    return {
      security_keywords: securityKeywords,
      emotional_keywords: emotionalKeywords,
      action_keywords: actionKeywords,
      temporal_keywords: temporalKeywords,
      intensity_modifiers: intensityModifiers
    };
  }
  
  /**
   * Language-specific keyword dictionaries
   */
  private getLanguageSpecificEmotionKeywords(languageCode: string): { [emotion: string]: string[] } {
    const keywords: { [lang: string]: { [emotion: string]: string[] } } = {
      'en': {
        'anger': ['angry', 'mad', 'furious', 'irritated', 'outraged'],
        'fear': ['afraid', 'scared', 'worried', 'anxious', 'terrified'],
        'joy': ['happy', 'excited', 'pleased', 'delighted', 'thrilled'],
        'sadness': ['sad', 'disappointed', 'depressed', 'dejected', 'grief']
      },
      'es': {
        'anger': ['enojado', 'furioso', 'irritado', 'indignado'],
        'fear': ['asustado', 'preocupado', 'ansioso', 'aterrorizado'],
        'joy': ['feliz', 'emocionado', 'encantado', 'alegre'],
        'sadness': ['triste', 'decepcionado', 'deprimido', 'afligido']
      },
      'fr': {
        'anger': ['en colère', 'furieux', 'irrité', 'indigné'],
        'fear': ['effrayé', 'inquiet', 'anxieux', 'terrifié'],
        'joy': ['heureux', 'excité', 'ravi', 'enchanté'],
        'sadness': ['triste', 'déçu', 'déprimé', 'affligé']
      }
    };
    
    return keywords[languageCode] || keywords['en'];
  }
  
  private getLanguageSpecificUrgencyKeywords(languageCode: string): { [level: string]: string[] } {
    const keywords: { [lang: string]: { [level: string]: string[] } } = {
      'en': {
        'critical': ['urgent', 'emergency', 'critical', 'immediate', 'asap'],
        'high': ['important', 'priority', 'soon', 'quickly'],
        'medium': ['moderate', 'normal', 'regular'],
        'low': ['later', 'eventually', 'whenever']
      },
      'es': {
        'critical': ['urgente', 'emergencia', 'crítico', 'inmediato'],
        'high': ['importante', 'prioridad', 'pronto', 'rápidamente'],
        'medium': ['moderado', 'normal', 'regular'],
        'low': ['después', 'eventualmente', 'cuando sea']
      }
    };
    
    return keywords[languageCode] || keywords['en'];
  }
  
  private getLanguageSpecificThreatKeywords(languageCode: string): string[] {
    const keywords: { [lang: string]: string[] } = {
      'en': ['threat', 'attack', 'breach', 'hack', 'malware', 'virus', 'exploit', 'vulnerability'],
      'es': ['amenaza', 'ataque', 'brecha', 'hackear', 'malware', 'virus', 'exploit', 'vulnerabilidad'],
      'fr': ['menace', 'attaque', 'brèche', 'piratage', 'malware', 'virus', 'exploit', 'vulnérabilité'],
      'de': ['bedrohung', 'angriff', 'verletzung', 'hack', 'malware', 'virus', 'exploit', 'schwachstelle'],
      'zh': ['威胁', '攻击', '漏洞', '黑客', '恶意软件', '病毒', '利用', '脆弱性']
    };
    
    return keywords[languageCode] || keywords['en'];
  }
  
  private getLanguageSpecificConfidenceKeywords(languageCode: string): { [level: string]: string[] } {
    const keywords: { [lang: string]: { [level: string]: string[] } } = {
      'en': {
        'high': ['certain', 'definitely', 'absolutely', 'confident', 'sure'],
        'medium': ['probably', 'likely', 'believe', 'think'],
        'low': ['maybe', 'possibly', 'uncertain', 'doubt', 'guess']
      },
      'es': {
        'high': ['cierto', 'definitivamente', 'absolutamente', 'seguro'],
        'medium': ['probablemente', 'posiblemente', 'creo', 'pienso'],
        'low': ['tal vez', 'posiblemente', 'incierto', 'dudo']
      }
    };
    
    return keywords[languageCode] || keywords['en'];
  }
  
  private getLanguageSpecificDeceptionKeywords(languageCode: string): string[] {
    const keywords: { [lang: string]: string[] } = {
      'en': ['lie', 'false', 'fake', 'pretend', 'deceive', 'mislead', 'dishonest'],
      'es': ['mentira', 'falso', 'fingir', 'engañar', 'mislead', 'deshonesto'],
      'fr': ['mensonge', 'faux', 'prétendre', 'tromper', 'induire en erreur', 'malhonnête']
    };
    
    return keywords[languageCode] || keywords['en'];
  }
  
  private detectContradictions(text: string, languageCode: string): string[] {
    // Simple contradiction detection
    const contradictions: string[] = [];
    const sentences = text.split(/[.!?]+/);
    
    // Look for negation followed by affirmation patterns
    for (let i = 0; i < sentences.length - 1; i++) {
      const current = sentences[i].toLowerCase();
      const next = sentences[i + 1].toLowerCase();
      
      if ((current.includes('not') || current.includes('no')) && 
          (next.includes('yes') || next.includes('but'))) {
        contradictions.push(`Contradiction between sentences ${i + 1} and ${i + 2}`);
      }
    }
    
    return contradictions;
  }

  /**
   * Simplified analyzeSentiment method for direct text analysis (used by NLP routes)
   */
  async analyzeSentiment(text: string, options: any = {}): Promise<any> {
    // Detect language
    const detectedLanguage = (await this.languageSupport.detectLanguage(text)).code;
    
    // Create a simplified request object
    const request: SentimentAnalysisRequest = {
      request_id: `simple_${Date.now()}`,
      text_inputs: [{
        text_id: 'input_1',
        content: text,
        metadata: {
          source: 'api',
          timestamp: new Date(),
          channel: 'document',
          language: detectedLanguage,
          context_type: 'external_communication'
        }
      }],
      analysis_options: {
        analyze_emotion: options.detailed_analysis !== false,
        analyze_urgency: options.detailed_analysis !== false,
        analyze_threat_level: options.detailed_analysis !== false,
        analyze_confidence: options.include_confidence !== false,
        analyze_deception: options.detailed_analysis !== false,
        detect_keywords: options.detailed_analysis !== false,
        confidence_threshold: options.confidence_threshold || 0.5
      },
      context: {
        domain: 'cybersecurity'
      }
    };
    
    // Use the full analysis method
    const fullResponse = await this.analyzeSentimentDetailed(request);
    
    // Return simplified response for API compatibility
    const textAnalysis = fullResponse.text_analyses[0];
    return {
      sentiment: textAnalysis.sentiment_scores.overall_sentiment,
      confidence: textAnalysis.sentiment_scores.confidence,
      severity_score: Math.abs(textAnalysis.sentiment_scores.polarity_score),
      emotional_indicators: textAnalysis.emotion_analysis.primary_emotion.indicators,
      risk_assessment: {
        threat_level: textAnalysis.threat_perception.perceived_threat_level,
        urgency: textAnalysis.urgency_analysis.urgency_level,
        confidence_level: textAnalysis.confidence_analysis.confidence_level
      },
      language_detected: detectedLanguage,
      processing_time: new Date().toISOString()
    };
  }

  async getModelInfo(): Promise<any> {
    return {
      service: 'SentimentAnalysisService',
      models: {
        sentiment_model: this.sentimentModel ? 'Loaded' : 'Not loaded',
        emotion_model: this.emotionModel ? 'Loaded' : 'Not loaded',
        urgency_model: this.urgencyModel ? 'Loaded' : 'Not loaded'
      },
      vocabulary_size: this.vocabularyMap.size,
      lexicon_size: this.securityLexicon.size,
      supported_languages: this.languageSupport.getSupportedLanguages().map(l => l.code),
      initialized: this.isInitialized
    };
  }
}
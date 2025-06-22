/**
 * Multi-Language Support Utilities
 * Provides language detection, translation, and localized processing for NLP services
 */

import { logger } from './logger';

export interface LanguageInfo {
  code: string;
  name: string;
  confidence: number;
  supported: boolean;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  preserveFormatting?: boolean;
}

export interface TranslationResponse {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  alternatives?: string[];
}

export interface LocalizedTerms {
  [language: string]: {
    [term: string]: string;
  };
}

// Security terminology in multiple languages
export const SECURITY_TERMS: LocalizedTerms = {
  en: {
    malware: 'malware',
    threat: 'threat',
    attack: 'attack',
    vulnerability: 'vulnerability',
    exploit: 'exploit',
    phishing: 'phishing',
    ransomware: 'ransomware',
    trojan: 'trojan',
    backdoor: 'backdoor',
    botnet: 'botnet',
    spyware: 'spyware',
    virus: 'virus',
    apt: 'advanced persistent threat',
    campaign: 'campaign',
    actor: 'threat actor',
    ioc: 'indicator of compromise',
    ttp: 'tactics techniques procedures'
  },
  es: {
    malware: 'malware',
    threat: 'amenaza',
    attack: 'ataque',
    vulnerability: 'vulnerabilidad',
    exploit: 'exploit',
    phishing: 'phishing',
    ransomware: 'ransomware',
    trojan: 'troyano',
    backdoor: 'puerta trasera',
    botnet: 'red de bots',
    spyware: 'software espía',
    virus: 'virus',
    apt: 'amenaza persistente avanzada',
    campaign: 'campaña',
    actor: 'actor de amenaza',
    ioc: 'indicador de compromiso',
    ttp: 'tácticas técnicas procedimientos'
  },
  fr: {
    malware: 'logiciel malveillant',
    threat: 'menace',
    attack: 'attaque',
    vulnerability: 'vulnérabilité',
    exploit: 'exploit',
    phishing: 'hameçonnage',
    ransomware: 'rançongiciel',
    trojan: 'cheval de troie',
    backdoor: 'porte dérobée',
    botnet: 'réseau de zombies',
    spyware: 'logiciel espion',
    virus: 'virus',
    apt: 'menace persistante avancée',
    campaign: 'campagne',
    actor: 'acteur de menace',
    ioc: 'indicateur de compromission',
    ttp: 'tactiques techniques procédures'
  },
  de: {
    malware: 'schadsoftware',
    threat: 'bedrohung',
    attack: 'angriff',
    vulnerability: 'schwachstelle',
    exploit: 'exploit',
    phishing: 'phishing',
    ransomware: 'erpressungssoftware',
    trojan: 'trojaner',
    backdoor: 'hintertür',
    botnet: 'botnetz',
    spyware: 'spionagesoftware',
    virus: 'virus',
    apt: 'fortgeschrittene anhaltende bedrohung',
    campaign: 'kampagne',
    actor: 'bedrohungsakteur',
    ioc: 'kompromittierungsindikator',
    ttp: 'taktiken techniken verfahren'
  },
  zh: {
    malware: '恶意软件',
    threat: '威胁',
    attack: '攻击',
    vulnerability: '漏洞',
    exploit: '利用',
    phishing: '网络钓鱼',
    ransomware: '勒索软件',
    trojan: '木马',
    backdoor: '后门',
    botnet: '僵尸网络',
    spyware: '间谍软件',
    virus: '病毒',
    apt: '高级持续威胁',
    campaign: '活动',
    actor: '威胁行为者',
    ioc: '妥协指标',
    ttp: '战术技术程序'
  },
  ru: {
    malware: 'вредоносное ПО',
    threat: 'угроза',
    attack: 'атака',
    vulnerability: 'уязвимость',
    exploit: 'эксплойт',
    phishing: 'фишинг',
    ransomware: 'программа-вымогатель',
    trojan: 'троян',
    backdoor: 'бэкдор',
    botnet: 'ботнет',
    spyware: 'шпионское ПО',
    virus: 'вирус',
    apt: 'продвинутая устойчивая угроза',
    campaign: 'кампания',
    actor: 'актор угрозы',
    ioc: 'индикатор компрометации',
    ttp: 'тактики техники процедуры'
  },
  ja: {
    malware: 'マルウェア',
    threat: '脅威',
    attack: '攻撃',
    vulnerability: '脆弱性',
    exploit: 'エクスプロイト',
    phishing: 'フィッシング',
    ransomware: 'ランサムウェア',
    trojan: 'トロイの木馬',
    backdoor: 'バックドア',
    botnet: 'ボットネット',
    spyware: 'スパイウェア',
    virus: 'ウイルス',
    apt: '高度持続的脅威',
    campaign: 'キャンペーン',
    actor: '脅威アクター',
    ioc: '侵害指標',
    ttp: '戦術技術手順'
  }
};

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ko', name: 'Korean', native: '한국어' }
];

export class LanguageSupportService {
  private static instance: LanguageSupportService;
  
  public static getInstance(): LanguageSupportService {
    if (!LanguageSupportService.instance) {
      LanguageSupportService.instance = new LanguageSupportService();
    }
    return LanguageSupportService.instance;
  }

  /**
   * Detect language of given text
   */
  async detectLanguage(text: string): Promise<LanguageInfo> {
    try {
      // Simple language detection based on character sets and common words
      const detectedLanguage = this.simpleLanguageDetection(text);
      
      return {
        code: detectedLanguage.code,
        name: detectedLanguage.name,
        confidence: detectedLanguage.confidence,
        supported: this.isLanguageSupported(detectedLanguage.code)
      };
    } catch (error) {
      logger.warn('Language detection failed, defaulting to English:', error);
      return {
        code: 'en',
        name: 'English',
        confidence: 0.5,
        supported: true
      };
    }
  }

  /**
   * Simple language detection based on patterns
   */
  private simpleLanguageDetection(text: string): { code: string; name: string; confidence: number } {
    const cleanText = text.toLowerCase();
    
    // Character-based detection
    if (/[\u4e00-\u9fff]/.test(text)) {
      return { code: 'zh', name: 'Chinese', confidence: 0.9 };
    }
    
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return { code: 'ja', name: 'Japanese', confidence: 0.9 };
    }
    
    if (/[\u0400-\u04ff]/.test(text)) {
      return { code: 'ru', name: 'Russian', confidence: 0.9 };
    }
    
    if (/[\uac00-\ud7af]/.test(text)) {
      return { code: 'ko', name: 'Korean', confidence: 0.9 };
    }

    // Word-based detection for Latin script languages
    const words = cleanText.split(/\s+/);
    const languageScores: { [key: string]: number } = {
      en: 0,
      es: 0,
      fr: 0,
      de: 0,
      pt: 0,
      it: 0
    };

    // Common words for each language
    const commonWords = {
      en: ['the', 'and', 'of', 'to', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i'],
      es: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para'],
      fr: ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se'],
      de: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als'],
      pt: ['o', 'de', 'a', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'das'],
      it: ['il', 'di', 'che', 'e', 'la', 'per', 'un', 'in', 'con', 'del', 'da', 'a', 'al', 'dei', 'le', 'su', 'gli', 'una', 'dei', 'nel']
    };

    // Score each language based on common word matches
    for (const word of words) {
      for (const [lang, commonWordsList] of Object.entries(commonWords)) {
        if (commonWordsList.includes(word)) {
          languageScores[lang]++;
        }
      }
    }

    // Find language with highest score
    let bestLanguage = 'en';
    let bestScore = 0;
    
    for (const [lang, score] of Object.entries(languageScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestLanguage = lang;
      }
    }

    const confidence = Math.min(0.95, Math.max(0.6, bestScore / words.length));
    const languageName = SUPPORTED_LANGUAGES.find(l => l.code === bestLanguage)?.name || 'English';

    return { code: bestLanguage, name: languageName, confidence };
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === languageCode);
  }

  /**
   * Translate text (simplified implementation)
   */
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      // For now, this is a placeholder implementation
      // In a real system, you would integrate with Google Translate, Azure Translator, etc.
      
      const sourceLanguage = request.sourceLanguage || 'auto';
      
      if (request.targetLanguage === 'en' && sourceLanguage !== 'en') {
        // Simple translation to English for security terms
        const translatedText = this.translateSecurityTermsToEnglish(request.text, sourceLanguage);
        
        return {
          translatedText,
          sourceLanguage,
          targetLanguage: request.targetLanguage,
          confidence: 0.8,
          alternatives: []
        };
      }

      // If source and target are the same, return original
      if (sourceLanguage === request.targetLanguage) {
        return {
          translatedText: request.text,
          sourceLanguage,
          targetLanguage: request.targetLanguage,
          confidence: 1.0,
          alternatives: []
        };
      }

      // For other language pairs, implement basic term substitution
      const translatedText = this.basicTermTranslation(request.text, sourceLanguage, request.targetLanguage);

      return {
        translatedText,
        sourceLanguage,
        targetLanguage: request.targetLanguage,
        confidence: 0.7,
        alternatives: []
      };

    } catch (error) {
      logger.error('Translation failed:', error);
      return {
        translatedText: request.text,
        sourceLanguage: request.sourceLanguage || 'unknown',
        targetLanguage: request.targetLanguage,
        confidence: 0.5,
        alternatives: []
      };
    }
  }

  /**
   * Translate security terms to English
   */
  private translateSecurityTermsToEnglish(text: string, sourceLanguage: string): string {
    if (sourceLanguage === 'en' || !SECURITY_TERMS[sourceLanguage]) {
      return text;
    }

    let translatedText = text;
    const sourceTerms = SECURITY_TERMS[sourceLanguage];
    const englishTerms = SECURITY_TERMS.en;

    // Replace security terms
    for (const [englishTerm, foreignTerm] of Object.entries(sourceTerms)) {
      if (foreignTerm && englishTerms[englishTerm]) {
        const regex = new RegExp(`\\b${this.escapeRegex(foreignTerm)}\\b`, 'gi');
        translatedText = translatedText.replace(regex, englishTerms[englishTerm]);
      }
    }

    return translatedText;
  }

  /**
   * Basic term translation between languages
   */
  private basicTermTranslation(text: string, sourceLanguage: string, targetLanguage: string): string {
    if (!SECURITY_TERMS[sourceLanguage] || !SECURITY_TERMS[targetLanguage]) {
      return text;
    }

    let translatedText = text;
    const sourceTerms = SECURITY_TERMS[sourceLanguage];
    const targetTerms = SECURITY_TERMS[targetLanguage];

    // Find common terms and translate
    for (const [key, sourceTerm] of Object.entries(sourceTerms)) {
      if (targetTerms[key]) {
        const regex = new RegExp(`\\b${this.escapeRegex(sourceTerm)}\\b`, 'gi');
        translatedText = translatedText.replace(regex, targetTerms[key]);
      }
    }

    return translatedText;
  }

  /**
   * Get localized security terms for a language
   */
  getLocalizedTerms(languageCode: string): { [key: string]: string } {
    return SECURITY_TERMS[languageCode] || SECURITY_TERMS.en;
  }

  /**
   * Normalize text for multi-language processing
   */
  normalizeTextForLanguage(text: string, languageCode: string): string {
    let normalized = text.trim();

    // Language-specific normalization
    switch (languageCode) {
      case 'zh':
        // Remove traditional Chinese variants, normalize spacing
        normalized = normalized.replace(/\s+/g, '');
        break;
      case 'ja':
        // Normalize Japanese text
        normalized = normalized.replace(/\s+/g, '');
        break;
      case 'ar':
        // Arabic text normalization
        normalized = normalized.replace(/[\u064B-\u0652]/g, ''); // Remove diacritics
        break;
      default:
        // Standard Latin script normalization
        normalized = normalized.toLowerCase();
        normalized = normalized.replace(/[^\w\s\-\.]/g, ' ');
        normalized = normalized.replace(/\s+/g, ' ');
        break;
    }

    return normalized;
  }

  /**
   * Extract language-specific patterns
   */
  extractLanguageSpecificPatterns(text: string, languageCode: string): any[] {
    const patterns: any[] = [];

    // Language-specific entity patterns
    switch (languageCode) {
      case 'en':
        patterns.push(...this.getEnglishPatterns(text));
        break;
      case 'zh':
        patterns.push(...this.getChinesePatterns(text));
        break;
      case 'ja':
        patterns.push(...this.getJapanesePatterns(text));
        break;
      default:
        // Use English patterns as fallback
        patterns.push(...this.getEnglishPatterns(text));
        break;
    }

    return patterns;
  }

  private getEnglishPatterns(text: string): any[] {
    // Implementation for English-specific patterns
    return [];
  }

  private getChinesePatterns(text: string): any[] {
    // Implementation for Chinese-specific patterns
    return [];
  }

  private getJapanesePatterns(text: string): any[] {
    // Implementation for Japanese-specific patterns
    return [];
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get supported language list
   */
  getSupportedLanguages(): Array<{ code: string; name: string; native: string }> {
    return [...SUPPORTED_LANGUAGES];
  }

  /**
   * Validate language code
   */
  isValidLanguageCode(code: string): boolean {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === code);
  }
}
// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests

// Jest globals
declare global {
  var jest: any;
}

// Mock Redis for tests
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
    flushAll: jest.fn().mockResolvedValue('OK'),
    ttl: jest.fn().mockResolvedValue(-1),
    on: jest.fn(),
    isOpen: true,
  })),
}));

// Mock TensorFlow.js for faster tests
jest.mock('@tensorflow/tfjs-node', () => ({
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({}),
    predict: jest.fn(() => ({
      data: jest.fn().mockResolvedValue([0.8, 0.2]),
      dispose: jest.fn(),
    })),
    save: jest.fn().mockResolvedValue({}),
    summary: jest.fn(),
  })),
  layers: {
    embedding: jest.fn(() => ({})),
    lstm: jest.fn(() => ({})),
    dense: jest.fn(() => ({})),
    dropout: jest.fn(() => ({})),
    bidirectional: jest.fn(() => ({})),
    globalMaxPooling1d: jest.fn(() => ({})),
  },
  tensor2d: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  tensor: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  train: {
    adam: jest.fn(),
  },
  losses: {
    binaryCrossentropy: 'binaryCrossentropy',
    categoricalCrossentropy: 'categoricalCrossentropy',
    sparseCategoricalCrossentropy: 'sparseCategoricalCrossentropy',
  },
  metrics: {
    accuracy: 'accuracy',
    categoricalAccuracy: 'categoricalAccuracy',
  },
}));

// Mock natural NLP library
jest.mock('natural', () => ({
  BayesClassifier: jest.fn(() => ({
    addDocument: jest.fn(),
    train: jest.fn(),
    classify: jest.fn(() => 'threat'),
    getClassifications: jest.fn(() => [
      { label: 'threat', value: 0.8 },
      { label: 'safe', value: 0.2 },
    ]),
  })),
  TfIdf: jest.fn(() => ({
    addDocument: jest.fn(),
    tfidfs: jest.fn((text, callback) => {
      callback(0, 0.5);
    }),
  })),
  SentimentAnalyzer: jest.fn(() => ({
    getSentiment: jest.fn(() => -0.5),
  })),
  PorterStemmer: {
    stem: jest.fn((word) => word.toLowerCase()),
  },
  WordTokenizer: jest.fn(() => ({
    tokenize: jest.fn((text) => text.split(' ')),
  })),
}));

// Mock compromise NLP library
jest.mock('compromise', () => {
  const mockDoc = {
    people: () => ({ out: () => ['John Doe'] }),
    places: () => ({ out: () => ['New York'] }),
    organizations: () => ({ out: () => ['ACME Corp'] }),
    dates: () => ({ out: () => ['2024-01-01'] }),
    match: () => ({ out: () => ['matched'] }),
    normalize: () => mockDoc,
    out: () => 'normalized text',
  };
  return jest.fn(() => mockDoc);
});

// Mock node-nlp
jest.mock('node-nlp', () => ({
  NlpManager: jest.fn(() => ({
    addLanguage: jest.fn(),
    addDocument: jest.fn(),
    addAnswer: jest.fn(),
    train: jest.fn(() => Promise.resolve()),
    process: jest.fn(() => Promise.resolve({
      intent: 'threat.detection',
      score: 0.9,
      entities: [
        { entity: 'threat', value: 'malware' },
      ],
    })),
  })),
}));

// Set test timeout
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  generateTestComponent: () => ({
    id: `comp-${Date.now()}`,
    type: 'Web API',
    description: 'Test component',
    dataFlow: ['user-input', 'database'],
    technologies: ['Node.js', 'Express'],
    interfaces: ['REST', 'HTTP'],
  }),
  
  generateTestThreat: () => ({
    id: `threat-${Date.now()}`,
    type: 'SQL Injection',
    description: 'Potential SQL injection vulnerability',
    probability: 0.8,
    impact: 'high',
    riskScore: 8.5,
  }),
};
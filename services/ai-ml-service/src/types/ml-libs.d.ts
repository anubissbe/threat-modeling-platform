/**
 * Type declarations for temporarily disabled ML libraries
 */

declare module 'node-nlp' {
  export class NlpManager {
    constructor(options?: any);
    addLanguage(lang: string): void;
    addDocument(locale: string, text: string, intent: string): void;
    addAnswer(locale: string, intent: string, answer: string): void;
    train(): Promise<void>;
    process(locale: string, text: string): Promise<any>;
  }
}

declare module 'ml-knn' {
  export class KNN {
    constructor(dataset: number[][], labels: number[], options?: any);
    predict(samples: number[][]): number[];
  }
}

declare namespace brain {
  interface NeuralNetworkOptions {
    hiddenLayers?: number[];
    learningRate?: number;
    iterations?: number;
    errorThresh?: number;
  }

  class NeuralNetwork {
    constructor(options?: NeuralNetworkOptions);
    train(data: Array<{input: any; output: any}>): any;
    run(input: any): any;
  }
}

declare namespace tf {
  interface LayersModel {
    predict(input: any): any;
    dispose(): void;
    getWeights(): any[];
    compile(config: any): void;
    fit(x: any, y: any, config?: any): Promise<any>;
    fitDataset(dataset: any, config?: any): Promise<any>;
    save(path: string): Promise<any>;
    summary(): void;
  }

  interface Tensor {
    array(): Promise<any>;
    dispose(): void;
    size: number;
    dataSync(): any;
  }

  interface Sequential extends LayersModel {
    add(layer: any): void;
  }

  interface Optimizer {
    minimize(f: () => any): void;
  }

  interface DataElement {
    xs: any;
    ys: any;
  }

  function loadLayersModel(path: string): Promise<LayersModel>;
  function tensor(data: any): Tensor;
  function tensor2d(data: any, shape?: number[]): Tensor;
  function sequential(): Sequential;
  
  const layers: {
    dense: (config: any) => any;
    lstm: (config: any) => any;
    embedding: (config: any) => any;
    dropout: (config: any) => any;
    bidirectional: (config: any) => any;
    globalMaxPooling1d: (config: any) => any;
  };

  const train: {
    adam: (learningRate?: number) => Optimizer;
    sgd: (learningRate?: number) => Optimizer;
  };

  const data: {
    array: (items: any[]) => any;
    generator: (generator: () => any) => any;
    zip: (datasets: any) => any;
  };

  const losses: {
    binaryCrossentropy: string;
    categoricalCrossentropy: string;
    sparseCategoricalCrossentropy: string;
    meanSquaredError: string;
  };

  const metrics: {
    accuracy: string;
    categoricalAccuracy: string;
    binaryAccuracy: string;
  };
}
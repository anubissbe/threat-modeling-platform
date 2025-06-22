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
  }

  interface Tensor {
    array(): Promise<any>;
    dispose(): void;
    size: number;
  }

  function loadLayersModel(path: string): Promise<LayersModel>;
  function tensor(data: any): Tensor;
  function sequential(): any;
  const layers: any;
}
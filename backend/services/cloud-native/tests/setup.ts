// Test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.LOG_LEVEL = 'error';

// Mock external dependencies
jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromFile: jest.fn(),
    loadFromDefault: jest.fn(),
    setCurrentContext: jest.fn(),
    makeApiClient: jest.fn(() => ({
      listNamespace: jest.fn().mockResolvedValue({ body: { items: [] } }),
      createNamespacedDeployment: jest.fn().mockResolvedValue({}),
      readNamespacedDeployment: jest.fn().mockResolvedValue({ body: {} }),
      patchNamespacedDeploymentScale: jest.fn().mockResolvedValue({})
    }))
  })),
  CoreV1Api: jest.fn(),
  AppsV1Api: jest.fn(),
  AutoscalingV2Api: jest.fn(),
  CustomObjectsApi: jest.fn(),
  Exec: jest.fn(),
  V1Status: jest.fn()
}));

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue(true),
    buildImage: jest.fn().mockResolvedValue({}),
    getImage: jest.fn().mockReturnValue({
      push: jest.fn().mockResolvedValue({}),
      tag: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue({})
    }),
    listImages: jest.fn().mockResolvedValue([]),
    createContainer: jest.fn().mockResolvedValue({}),
    getContainer: jest.fn().mockReturnValue({
      start: jest.fn().mockResolvedValue({}),
      stop: jest.fn().mockResolvedValue({}),
      logs: jest.fn().mockResolvedValue(''),
      exec: jest.fn().mockResolvedValue({})
    }),
    listContainers: jest.fn().mockResolvedValue([]),
    createNetwork: jest.fn().mockResolvedValue({}),
    createVolume: jest.fn().mockResolvedValue({}),
    pruneContainers: jest.fn().mockResolvedValue({}),
    pruneImages: jest.fn().mockResolvedValue({}),
    pruneVolumes: jest.fn().mockResolvedValue({}),
    pruneNetworks: jest.fn().mockResolvedValue({}),
    info: jest.fn().mockResolvedValue({}),
    modem: {
      followProgress: jest.fn((_stream, onFinished, onProgress) => {
        onProgress({ stream: 'Building...' });
        onFinished(null, {});
      })
    }
  }));
});

// Set test timeout
jest.setTimeout(30000);
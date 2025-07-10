import { Router } from 'express';
import { CloudNativeController } from '../controllers/cloud-native.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorization.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { rateLimiter } from '../middleware/rate-limit.middleware';
import { requestLogger } from '../middleware/request-logger.middleware';

export function createCloudNativeRoutes(
  controller: CloudNativeController
): Router {
  const router = Router();

  // Apply common middleware
  router.use(requestLogger);
  router.use(rateLimiter);

  // Deployment routes
  router.post(
    '/deployments',
    authenticate,
    authorize(['admin', 'developer']),
    validateRequest('deploy'),
    controller.deployApplication.bind(controller)
  );

  router.put(
    '/deployments/:namespace/:name/scale',
    authenticate,
    authorize(['admin', 'developer']),
    validateRequest('scale'),
    controller.scaleDeployment.bind(controller)
  );

  router.put(
    '/deployments/:namespace/:name/rollout',
    authenticate,
    authorize(['admin', 'developer']),
    validateRequest('rollout'),
    controller.performRollout.bind(controller)
  );

  router.get(
    '/deployments/:namespace/:name',
    authenticate,
    controller.getDeploymentStatus.bind(controller)
  );

  router.get(
    '/deployments',
    authenticate,
    controller.getAllDeployments.bind(controller)
  );

  // Service routes
  router.get(
    '/services/:namespace/:name',
    authenticate,
    controller.getServiceStatus.bind(controller)
  );

  router.get(
    '/services',
    authenticate,
    controller.getAllServices.bind(controller)
  );

  // Pod routes
  router.get(
    '/pods/:namespace',
    authenticate,
    controller.getPodStatus.bind(controller)
  );

  // Docker routes
  router.post(
    '/docker/build',
    authenticate,
    authorize(['admin', 'developer']),
    validateRequest('docker-build'),
    controller.buildDockerImage.bind(controller)
  );

  router.post(
    '/docker/push',
    authenticate,
    authorize(['admin', 'developer']),
    validateRequest('docker-push'),
    controller.pushDockerImage.bind(controller)
  );

  // Manifest routes
  router.post(
    '/manifest/apply',
    authenticate,
    authorize(['admin']),
    validateRequest('manifest'),
    controller.applyManifest.bind(controller)
  );

  // Event routes
  router.get(
    '/events',
    authenticate,
    controller.getEvents.bind(controller)
  );

  // Health check
  router.get(
    '/health',
    controller.healthCheck.bind(controller)
  );

  return router;
}

// Kubernetes-specific routes
export function createKubernetesRoutes(
  kubernetesController: any
): Router {
  const router = Router();

  router.use(requestLogger);
  router.use(rateLimiter);

  // Namespace routes
  router.post(
    '/namespaces',
    authenticate,
    authorize(['admin']),
    kubernetesController.createNamespace.bind(kubernetesController)
  );

  router.get(
    '/namespaces',
    authenticate,
    kubernetesController.listNamespaces.bind(kubernetesController)
  );

  // ConfigMap routes
  router.post(
    '/configmaps/:namespace',
    authenticate,
    authorize(['admin', 'developer']),
    kubernetesController.createConfigMap.bind(kubernetesController)
  );

  // Secret routes
  router.post(
    '/secrets/:namespace',
    authenticate,
    authorize(['admin']),
    kubernetesController.createSecret.bind(kubernetesController)
  );

  // Autoscaling routes
  router.post(
    '/autoscaling/hpa/:namespace',
    authenticate,
    authorize(['admin', 'developer']),
    kubernetesController.createHPA.bind(kubernetesController)
  );

  router.post(
    '/autoscaling/vpa/:namespace',
    authenticate,
    authorize(['admin', 'developer']),
    kubernetesController.createVPA.bind(kubernetesController)
  );

  // Cluster management
  router.get(
    '/clusters',
    authenticate,
    kubernetesController.getClusters.bind(kubernetesController)
  );

  router.put(
    '/clusters/:name/switch',
    authenticate,
    authorize(['admin']),
    kubernetesController.switchCluster.bind(kubernetesController)
  );

  // Pod operations
  router.get(
    '/pods/:namespace/:name/logs',
    authenticate,
    kubernetesController.getPodLogs.bind(kubernetesController)
  );

  router.post(
    '/pods/:namespace/:name/exec',
    authenticate,
    authorize(['admin', 'developer']),
    kubernetesController.execInPod.bind(kubernetesController)
  );

  return router;
}

// Docker-specific routes
export function createDockerRoutes(
  dockerController: any
): Router {
  const router = Router();

  router.use(requestLogger);
  router.use(rateLimiter);

  // Image management
  router.get(
    '/images',
    authenticate,
    dockerController.listImages.bind(dockerController)
  );

  router.delete(
    '/images/:id',
    authenticate,
    authorize(['admin']),
    dockerController.removeImage.bind(dockerController)
  );

  router.post(
    '/images/tag',
    authenticate,
    authorize(['admin', 'developer']),
    dockerController.tagImage.bind(dockerController)
  );

  router.post(
    '/images/pull',
    authenticate,
    authorize(['admin', 'developer']),
    dockerController.pullImage.bind(dockerController)
  );

  // Container management
  router.get(
    '/containers',
    authenticate,
    dockerController.listContainers.bind(dockerController)
  );

  router.post(
    '/containers',
    authenticate,
    authorize(['admin', 'developer']),
    dockerController.createContainer.bind(dockerController)
  );

  router.post(
    '/containers/:id/start',
    authenticate,
    authorize(['admin', 'developer']),
    dockerController.startContainer.bind(dockerController)
  );

  router.post(
    '/containers/:id/stop',
    authenticate,
    authorize(['admin', 'developer']),
    dockerController.stopContainer.bind(dockerController)
  );

  router.get(
    '/containers/:id/logs',
    authenticate,
    dockerController.getContainerLogs.bind(dockerController)
  );

  router.post(
    '/containers/:id/exec',
    authenticate,
    authorize(['admin', 'developer']),
    dockerController.execInContainer.bind(dockerController)
  );

  // Network and volume management
  router.post(
    '/networks',
    authenticate,
    authorize(['admin']),
    dockerController.createNetwork.bind(dockerController)
  );

  router.post(
    '/volumes',
    authenticate,
    authorize(['admin']),
    dockerController.createVolume.bind(dockerController)
  );

  // System operations
  router.post(
    '/prune',
    authenticate,
    authorize(['admin']),
    dockerController.pruneResources.bind(dockerController)
  );

  router.get(
    '/info',
    authenticate,
    dockerController.getInfo.bind(dockerController)
  );

  return router;
}

// Service mesh routes
export function createServiceMeshRoutes(
  serviceMeshController: any
): Router {
  const router = Router();

  router.use(requestLogger);
  router.use(rateLimiter);

  // Traffic management
  router.post(
    '/traffic/:namespace/:service',
    authenticate,
    authorize(['admin', 'developer']),
    serviceMeshController.configureTrafficManagement.bind(serviceMeshController)
  );

  // Security
  router.post(
    '/security/mtls/:namespace',
    authenticate,
    authorize(['admin']),
    serviceMeshController.configureMTLS.bind(serviceMeshController)
  );

  router.post(
    '/security/authorization',
    authenticate,
    authorize(['admin']),
    serviceMeshController.createAuthorizationPolicy.bind(serviceMeshController)
  );

  router.post(
    '/security/jwt/:namespace',
    authenticate,
    authorize(['admin']),
    serviceMeshController.configureJWTAuth.bind(serviceMeshController)
  );

  // Observability
  router.post(
    '/observability/:namespace',
    authenticate,
    authorize(['admin', 'developer']),
    serviceMeshController.configureObservability.bind(serviceMeshController)
  );

  router.get(
    '/metrics/:namespace/:service',
    authenticate,
    serviceMeshController.getMetrics.bind(serviceMeshController)
  );

  // Service mesh operations
  router.post(
    '/sidecar/:namespace/enable',
    authenticate,
    authorize(['admin']),
    serviceMeshController.enableSidecarInjection.bind(serviceMeshController)
  );

  router.post(
    '/service-entry',
    authenticate,
    authorize(['admin']),
    serviceMeshController.createServiceEntry.bind(serviceMeshController)
  );

  router.post(
    '/gateway',
    authenticate,
    authorize(['admin']),
    serviceMeshController.createGateway.bind(serviceMeshController)
  );

  return router;
}
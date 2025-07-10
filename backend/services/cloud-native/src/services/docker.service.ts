import Docker from 'dockerode';
import { logger } from '../utils/logger';
import {
  DockerConfig,
  DockerRegistry
} from '../types/cloud-native';

export class DockerService {
  private config: DockerConfig;
  private client!: Docker;
  private registries: Map<string, DockerRegistry> = new Map();

  constructor(config: DockerConfig) {
    this.config = config;
    this.initializeClient();
    this.initializeRegistries();
  }

  /**
   * Initialize Docker client
   */
  private initializeClient(): void {
    try {
      this.client = new Docker({
        socketPath: '/var/run/docker.sock'
      });
      
      logger.info('Docker client initialized');
    } catch (error) {
      logger.error('Failed to initialize Docker client', error);
      throw error;
    }
  }

  /**
   * Initialize Docker registries
   */
  private initializeRegistries(): void {
    for (const registry of this.config.registries) {
      this.registries.set(registry.name, registry);
    }
  }

  /**
   * Build Docker image
   */
  public async buildImage(
    dockerfile: string,
    context: string,
    tag: string,
    buildArgs?: Record<string, string>
  ): Promise<void> {
    try {
      const stream = await this.client.buildImage(
        {
          context,
          src: [dockerfile]
        },
        {
          t: tag,
          buildargs: buildArgs || this.config.buildConfig.args,
          target: this.config.buildConfig.target,
          nocache: !this.config.buildConfig.cache
        }
      );

      await new Promise((resolve, reject) => {
        this.client.modem.followProgress(
          stream,
          (err: any, res: any) => err ? reject(err) : resolve(res),
          (event: any) => {
            if (event.stream) {
              logger.debug(`Docker build: ${event.stream.trim()}`);
            }
          }
        );
      });

      logger.info(`Docker image built successfully: ${tag}`);
    } catch (error) {
      logger.error('Failed to build Docker image', error);
      throw error;
    }
  }

  /**
   * Push image to registry
   */
  public async pushImage(tag: string, registryName?: string): Promise<void> {
    try {
      const registry = registryName 
        ? this.registries.get(registryName) 
        : this.config.registries[0];
      
      if (!registry) {
        throw new Error('No registry configured');
      }

      const image = this.client.getImage(tag);
      const stream = await image.push({
        authconfig: {
          username: registry.username,
          password: registry.password,
          email: registry.email,
          serveraddress: registry.url
        }
      });

      await new Promise((resolve, reject) => {
        this.client.modem.followProgress(
          stream,
          (err: any, res: any) => err ? reject(err) : resolve(res),
          (event: any) => {
            if (event.status) {
              logger.debug(`Docker push: ${event.status}`);
            }
          }
        );
      });

      logger.info(`Docker image pushed successfully: ${tag}`);
    } catch (error) {
      logger.error('Failed to push Docker image', error);
      throw error;
    }
  }

  /**
   * Pull image from registry
   */
  public async pullImage(image: string, registryName?: string): Promise<void> {
    try {
      const registry = registryName 
        ? this.registries.get(registryName) 
        : this.config.registries[0];

      const auth = registry ? {
        username: registry.username,
        password: registry.password,
        email: registry.email,
        serveraddress: registry.url
      } : undefined;

      const stream = await this.client.pull(image, { authconfig: auth });

      await new Promise((resolve, reject) => {
        this.client.modem.followProgress(
          stream,
          (err: any, res: any) => err ? reject(err) : resolve(res),
          (event: any) => {
            if (event.status) {
              logger.debug(`Docker pull: ${event.status}`);
            }
          }
        );
      });

      logger.info(`Docker image pulled successfully: ${image}`);
    } catch (error) {
      logger.error('Failed to pull Docker image', error);
      throw error;
    }
  }

  /**
   * Tag image
   */
  public async tagImage(source: string, target: string): Promise<void> {
    try {
      const image = this.client.getImage(source);
      const [repo, tag] = target.split(':');
      
      await image.tag({
        repo,
        tag: tag || 'latest'
      });

      logger.info(`Image tagged: ${source} -> ${target}`);
    } catch (error) {
      logger.error('Failed to tag image', error);
      throw error;
    }
  }

  /**
   * List images
   */
  public async listImages(): Promise<Docker.ImageInfo[]> {
    try {
      return await this.client.listImages();
    } catch (error) {
      logger.error('Failed to list images', error);
      throw error;
    }
  }

  /**
   * Remove image
   */
  public async removeImage(image: string, force: boolean = false): Promise<void> {
    try {
      await this.client.getImage(image).remove({ force });
      logger.info(`Image removed: ${image}`);
    } catch (error) {
      logger.error('Failed to remove image', error);
      throw error;
    }
  }

  /**
   * Create container
   */
  public async createContainer(
    image: string,
    name: string,
    config?: Docker.ContainerCreateOptions
  ): Promise<Docker.Container> {
    try {
      const container = await this.client.createContainer({
        Image: image,
        name,
        Env: Object.entries(this.config.runtimeConfig.environment).map(
          ([key, value]) => `${key}=${value}`
        ),
        HostConfig: {
          NetworkMode: this.config.runtimeConfig.network,
          CpuShares: parseInt(this.config.runtimeConfig.resources.cpus) * 1024,
          Memory: this.parseMemory(this.config.runtimeConfig.resources.memory)
        },
        ...config
      });

      logger.info(`Container created: ${name}`);
      return container;
    } catch (error) {
      logger.error('Failed to create container', error);
      throw error;
    }
  }

  /**
   * Start container
   */
  public async startContainer(containerId: string): Promise<void> {
    try {
      const container = this.client.getContainer(containerId);
      await container.start();
      logger.info(`Container started: ${containerId}`);
    } catch (error) {
      logger.error('Failed to start container', error);
      throw error;
    }
  }

  /**
   * Stop container
   */
  public async stopContainer(containerId: string, timeout?: number): Promise<void> {
    try {
      const container = this.client.getContainer(containerId);
      await container.stop({ t: timeout });
      logger.info(`Container stopped: ${containerId}`);
    } catch (error) {
      logger.error('Failed to stop container', error);
      throw error;
    }
  }

  /**
   * List containers
   */
  public async listContainers(all: boolean = false): Promise<Docker.ContainerInfo[]> {
    try {
      return await this.client.listContainers({ all });
    } catch (error) {
      logger.error('Failed to list containers', error);
      throw error;
    }
  }

  /**
   * Get container logs
   */
  public async getContainerLogs(
    containerId: string,
    tail?: number
  ): Promise<string> {
    try {
      const container = this.client.getContainer(containerId);
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        tail: tail || 100
      });

      return stream.toString();
    } catch (error) {
      logger.error('Failed to get container logs', error);
      throw error;
    }
  }

  /**
   * Execute command in container
   */
  public async execInContainer(
    containerId: string,
    command: string[]
  ): Promise<string> {
    try {
      const container = this.client.getContainer(containerId);
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({ hijack: true, stdin: true });
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (chunk: Buffer) => {
          output += chunk.toString();
        });
        stream.on('end', () => resolve(output));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to execute command in container', error);
      throw error;
    }
  }

  /**
   * Create network
   */
  public async createNetwork(name: string, driver: string = 'bridge'): Promise<void> {
    try {
      await this.client.createNetwork({
        Name: name,
        Driver: driver
      });
      logger.info(`Network created: ${name}`);
    } catch (error) {
      logger.error('Failed to create network', error);
      throw error;
    }
  }

  /**
   * Create volume
   */
  public async createVolume(name: string, driver: string = 'local'): Promise<void> {
    try {
      await this.client.createVolume({
        Name: name,
        Driver: driver
      });
      logger.info(`Volume created: ${name}`);
    } catch (error) {
      logger.error('Failed to create volume', error);
      throw error;
    }
  }

  /**
   * Prune unused resources
   */
  public async pruneResources(): Promise<void> {
    try {
      await this.client.pruneContainers();
      await this.client.pruneImages();
      await this.client.pruneVolumes();
      await this.client.pruneNetworks();
      logger.info('Docker resources pruned');
    } catch (error) {
      logger.error('Failed to prune resources', error);
      throw error;
    }
  }

  /**
   * Get Docker info
   */
  public async getInfo(): Promise<any> {
    try {
      return await this.client.info();
    } catch (error) {
      logger.error('Failed to get Docker info', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Docker health check failed', error);
      return false;
    }
  }

  /**
   * Parse memory string to bytes
   */
  private parseMemory(memory: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };

    const match = memory.toLowerCase().match(/^(\d+)([bkmg])?$/);
    if (!match) {
      throw new Error(`Invalid memory format: ${memory}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2] || 'b';
    
    return value * units[unit];
  }
}
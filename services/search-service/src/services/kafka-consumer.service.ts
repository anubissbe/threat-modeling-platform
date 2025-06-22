import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { config } from '../config';
import { logger, searchLogger } from '../utils/logger';
import { searchIndexerService } from './search-indexer.service';
import { IndexingEvent, ContentType } from '../types';

export class KafkaConsumerService {
  private kafka: Kafka;
  private consumer: Consumer;
  private isConnected: boolean = false;
  private readonly topics: string[];

  constructor() {
    this.kafka = new Kafka({
      clientId: 'search-service',
      brokers: config.KAFKA_BROKERS.split(','),
      connectionTimeout: 10000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 1000,
        retries: 3,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: 'search-service-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    // Define topics to subscribe to
    this.topics = [
      `${config.KAFKA_TOPIC_PREFIX}_threats`,
      `${config.KAFKA_TOPIC_PREFIX}_projects`,
      `${config.KAFKA_TOPIC_PREFIX}_threat_models`,
      `${config.KAFKA_TOPIC_PREFIX}_users`,
      `${config.KAFKA_TOPIC_PREFIX}_files`,
      `${config.KAFKA_TOPIC_PREFIX}_reports`,
    ];
  }

  async initialize(): Promise<void> {
    if (!config.ENABLE_REAL_TIME_INDEXING) {
      logger.info('Real-time indexing is disabled');
      return;
    }

    try {
      logger.info('Initializing Kafka consumer for real-time indexing...');

      // Connect to Kafka
      await this.consumer.connect();
      this.isConnected = true;

      // Subscribe to topics
      await this.consumer.subscribe({
        topics: this.topics,
        fromBeginning: false, // Start from latest messages
      });

      // Start consuming messages
      await this.consumer.run({
        eachMessage: this.handleMessage.bind(this),
        partitionsConsumedConcurrently: 3,
      });

      logger.info('Kafka consumer initialized successfully');
      logger.info(`Subscribed to topics: ${this.topics.join(', ')}`);

    } catch (error: any) {
      logger.error('Failed to initialize Kafka consumer:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.consumer.disconnect();
        this.isConnected = false;
        logger.info('Kafka consumer disconnected');
      }
    } catch (error: any) {
      logger.error('Error during Kafka consumer shutdown:', error);
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    
    try {
      if (!message.value) {
        logger.warn(`Received empty message from topic ${topic}`);
        return;
      }

      // Parse the message
      const indexingEvent: IndexingEvent = JSON.parse(message.value.toString());
      
      // Validate the event
      if (!this.isValidIndexingEvent(indexingEvent)) {
        logger.warn(`Invalid indexing event received from topic ${topic}:`, indexingEvent);
        return;
      }

      logger.debug(`Processing indexing event:`, {
        topic,
        partition,
        offset: message.offset,
        event: indexingEvent,
      });

      // Process the indexing event
      await searchIndexerService.processIndexingEvent(indexingEvent);

      // Log successful processing
      searchLogger.contentSynchronized(
        indexingEvent.contentType,
        indexingEvent.contentId,
        indexingEvent.type,
        0 // Duration is handled in the indexer service
      );

    } catch (error: any) {
      logger.error(`Error processing message from topic ${topic}:`, {
        error: error.message,
        topic,
        partition,
        offset: message.offset,
        message: message.value?.toString().substring(0, 200),
      });

      // In a production environment, you might want to send failed messages
      // to a dead letter queue for manual processing
      await this.handleFailedMessage(payload, error);
    }
  }

  private isValidIndexingEvent(event: any): event is IndexingEvent {
    return (
      event &&
      typeof event === 'object' &&
      typeof event.type === 'string' &&
      ['create', 'update', 'delete'].includes(event.type) &&
      typeof event.contentType === 'string' &&
      typeof event.contentId === 'string' &&
      typeof event.timestamp === 'string' &&
      (event.type === 'delete' || (event.content && typeof event.content === 'object'))
    );
  }

  private async handleFailedMessage(
    payload: EachMessagePayload,
    error: Error,
  ): Promise<void> {
    // Log the failure
    logger.error(`Failed to process message from ${payload.topic}:`, {
      topic: payload.topic,
      partition: payload.partition,
      offset: payload.message.offset,
      error: error.message,
    });

    // You could implement retry logic here or send to a dead letter queue
    // For now, we'll just log the failure
  }

  private extractContentTypeFromTopic(topic: string): ContentType | null {
    const topicSuffix = topic.replace(`${config.KAFKA_TOPIC_PREFIX}_`, '');
    
    switch (topicSuffix) {
      case 'threats':
        return 'threat';
      case 'projects':
        return 'project';
      case 'threat_models':
        return 'threat_model';
      case 'users':
        return 'user';
      case 'files':
        return 'file';
      case 'reports':
        return 'report';
      default:
        return null;
    }
  }

  async getConsumerInfo(): Promise<any> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();

      const groupDetails = await admin.describeGroups(['search-service-group']);
      const topicMetadata = await admin.fetchTopicMetadata({ topics: this.topics });

      await admin.disconnect();

      return {
        connected: this.isConnected,
        groupId: 'search-service-group',
        topics: this.topics,
        groupDetails,
        topicMetadata,
      };
    } catch (error: any) {
      logger.error('Error getting consumer info:', error);
      throw error;
    }
  }

  async resetConsumerOffset(topic: string, partition: number, offset: string): Promise<void> {
    try {
      if (this.isConnected) {
        await this.consumer.pause([{ topic, partitions: [partition] }]);
        await this.consumer.seek({ topic, partition, offset });
        await this.consumer.resume([{ topic, partitions: [partition] }]);
        
        logger.info(`Reset consumer offset for ${topic}:${partition} to ${offset}`);
      }
    } catch (error: any) {
      logger.error(`Error resetting consumer offset:`, error);
      throw error;
    }
  }

  async pauseConsumer(topics?: string[]): Promise<void> {
    try {
      const topicsToPause = topics || this.topics;
      const topicPartitions = topicsToPause.map(topic => ({ topic }));
      
      await this.consumer.pause(topicPartitions);
      logger.info(`Paused consumer for topics: ${topicsToPause.join(', ')}`);
    } catch (error: any) {
      logger.error('Error pausing consumer:', error);
      throw error;
    }
  }

  async resumeConsumer(topics?: string[]): Promise<void> {
    try {
      const topicsToResume = topics || this.topics;
      const topicPartitions = topicsToResume.map(topic => ({ topic }));
      
      await this.consumer.resume(topicPartitions);
      logger.info(`Resumed consumer for topics: ${topicsToResume.join(', ')}`);
    } catch (error: any) {
      logger.error('Error resuming consumer:', error);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSubscribedTopics(): string[] {
    return [...this.topics];
  }
}

// Export singleton instance
export const kafkaConsumerService = new KafkaConsumerService();
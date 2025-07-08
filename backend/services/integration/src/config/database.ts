import { Pool } from 'pg';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: process.env['DATABASE_URL'] || 
    `postgresql://${process.env['DB_USER']}:${process.env['DB_PASSWORD']}@${process.env['DB_HOST']}:${process.env['DB_PORT']}/${process.env['DB_NAME']}`,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
});

export async function initializeDatabase(): Promise<void> {
  try {
    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    // Create tables if they don't exist
    await createTables();
    
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

async function createTables(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create service_integrations table (renamed to avoid conflict with existing integrations table)
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL CHECK (provider IN ('jira', 'github', 'gitlab', 'azure_devops')),
        config JSONB NOT NULL DEFAULT '{}',
        credentials TEXT NOT NULL, -- Encrypted credentials
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
        last_sync_at TIMESTAMP,
        sync_frequency_minutes INTEGER DEFAULT 60,
        created_by UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, created_by)
      )
    `);

    // Create integration_mappings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS integration_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_id UUID NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
        threat_model_id UUID NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        external_url VARCHAR(1000),
        provider VARCHAR(50) NOT NULL,
        mapping_type VARCHAR(50) NOT NULL DEFAULT 'threat_model',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(integration_id, threat_model_id, provider)
      )
    `);

    // Create integration_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS integration_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_id UUID NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
        details JSONB DEFAULT '{}',
        error_message TEXT,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create webhook_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_id UUID REFERENCES service_integrations(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        signature VARCHAR(500),
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_service_integrations_provider ON service_integrations(provider)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_service_integrations_status ON service_integrations(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_service_integrations_created_by ON service_integrations(created_by)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_mappings_threat_model ON integration_mappings(threat_model_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_mappings_external ON integration_mappings(external_id, provider)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_logs_integration ON integration_logs(integration_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_logs_status ON integration_logs(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_integration ON webhook_events(integration_id)');

    // Create triggers for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_service_integrations_updated_at') THEN
          CREATE TRIGGER update_service_integrations_updated_at BEFORE UPDATE ON service_integrations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mappings_updated_at') THEN
          CREATE TRIGGER update_mappings_updated_at BEFORE UPDATE ON integration_mappings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END
      $$;
    `);

    await client.query('COMMIT');
    logger.info('Database tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to create database tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res.rows;
  } catch (error) {
    logger.error('Database query error', { text, error });
    throw error;
  }
}

export async function getClient() {
  const client = await pool.connect();
  const query = client.query.bind(client);

  // Ensure release is called on error
  const timeout = setTimeout(() => {
    logger.error('Client has been checked out for more than 5 seconds!');
  }, 5000);

  const releaseWithTimeout = () => {
    clearTimeout(timeout);
    client.release();
  };

  return {
    query,
    release: releaseWithTimeout,
    client,
  };
}
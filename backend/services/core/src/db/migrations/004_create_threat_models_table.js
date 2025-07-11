exports.up = async function(knex) {
  // Create threat_models table
  await knex.schema.createTable('threat_models', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.text('description');
    table.uuid('project_id').notNullable()
      .references('id').inTable('projects').onDelete('CASCADE');
    table.string('methodology').defaultTo('STRIDE');
    table.string('version').defaultTo('1.0');
    table.string('status').defaultTo('draft');
    table.jsonb('scope');
    table.jsonb('assets');
    table.jsonb('data_flows');
    table.jsonb('trust_boundaries');
    table.jsonb('entry_points');
    table.jsonb('metadata');
    table.uuid('created_by').notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.timestamp('published_at');
    table.timestamps(true, true);
    
    // Indexes
    table.index('project_id');
    table.index('status');
    table.index('created_by');
  });

  // Create threats table
  await knex.schema.createTable('threats', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('threat_model_id').notNullable()
      .references('id').inTable('threat_models').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('category').notNullable();
    table.string('status').defaultTo('identified');
    table.string('likelihood').defaultTo('Medium');
    table.string('impact').defaultTo('Medium');
    table.string('risk_level').defaultTo('Medium');
    table.string('affected_component');
    table.specificType('affected_assets', 'text[]');
    table.specificType('threat_sources', 'text[]');
    table.specificType('prerequisites', 'text[]');
    table.jsonb('metadata');
    table.uuid('created_by').notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('assigned_to')
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('identified_at').defaultTo(knex.fn.now());
    table.timestamp('resolved_at');
    table.timestamps(true, true);
    
    // Indexes
    table.index('threat_model_id');
    table.index('status');
    table.index('risk_level');
    table.index('assigned_to');
  });

  // Create mitigations table
  await knex.schema.createTable('mitigations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('threat_id').notNullable()
      .references('id').inTable('threats').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('type').notNullable();
    table.string('status').defaultTo('proposed');
    table.string('effectiveness').defaultTo('High');
    table.string('implementation_cost').defaultTo('Medium');
    table.string('implementation_time').defaultTo('Medium');
    table.integer('priority');
    table.specificType('requirements', 'text[]');
    table.jsonb('validation_steps');
    table.jsonb('metadata');
    table.uuid('created_by').notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('implemented_by')
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('implemented_at');
    table.timestamps(true, true);
    
    // Indexes
    table.index('threat_id');
    table.index('status');
    table.index('type');
  });

  // Create threat_templates table
  await knex.schema.createTable('threat_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('category').notNullable();
    table.string('methodology').notNullable();
    table.string('severity').defaultTo('Medium');
    table.jsonb('applicable_to');
    table.jsonb('example_instances');
    table.jsonb('common_mitigations');
    table.boolean('is_active').defaultTo(true);
    table.uuid('created_by')
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // Indexes
    table.index('category');
    table.index('methodology');
    table.index('is_active');
  });

  // Create attack_patterns table
  await knex.schema.createTable('attack_patterns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('pattern_id').unique().notNullable();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('category').notNullable();
    table.string('severity').defaultTo('Medium');
    table.specificType('platforms', 'text[]');
    table.jsonb('techniques');
    table.jsonb('mitigations');
    table.jsonb('detection_methods');
    table.jsonb('references');
    table.timestamps(true, true);
    
    // Indexes
    table.index('pattern_id');
    table.index('category');
  });

  // Create threat_model_reviews table
  await knex.schema.createTable('threat_model_reviews', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('threat_model_id').notNullable()
      .references('id').inTable('threat_models').onDelete('CASCADE');
    table.uuid('reviewer_id').notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.string('status').defaultTo('pending');
    table.text('comments');
    table.jsonb('findings');
    table.integer('risk_rating');
    table.timestamp('completed_at');
    table.timestamps(true, true);
    
    // Indexes
    table.index('threat_model_id');
    table.index('reviewer_id');
    table.index('status');
  });

  // Create threat_model_history table
  await knex.schema.createTable('threat_model_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('threat_model_id').notNullable()
      .references('id').inTable('threat_models').onDelete('CASCADE');
    table.string('action').notNullable();
    table.jsonb('changes');
    table.text('comment');
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.string('version');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('threat_model_id');
    table.index('user_id');
    table.index('created_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('threat_model_history');
  await knex.schema.dropTableIfExists('threat_model_reviews');
  await knex.schema.dropTableIfExists('attack_patterns');
  await knex.schema.dropTableIfExists('threat_templates');
  await knex.schema.dropTableIfExists('mitigations');
  await knex.schema.dropTableIfExists('threats');
  await knex.schema.dropTableIfExists('threat_models');
};
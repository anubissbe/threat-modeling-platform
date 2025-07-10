import { RedisClientType } from 'redis';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { ThreatModelOperation, OperationResult, ConflictInfo, ConflictResolution } from '../types/collaboration';

export class ConflictResolutionService {
  private operationQueue: Map<string, ThreatModelOperation[]> = new Map();
  private lockTimeout = 30000; // 30 seconds

  constructor(
    private redis: RedisClientType,
    private db: Pool
  ) {}

  async processOperation(operation: ThreatModelOperation): Promise<OperationResult> {
    const lockKey = `lock:threat-model:${operation.threatModelId}`;
    const operationId = this.generateOperationId();

    try {
      // Acquire distributed lock
      const lockAcquired = await this.acquireLock(lockKey, operationId);
      if (!lockAcquired) {
        return {
          success: false,
          operationId,
          error: 'Could not acquire lock - system busy'
        };
      }

      // Get current state
      const currentState = await this.getCurrentState(operation.threatModelId);
      
      // Check for conflicts
      const conflictInfo = await this.detectConflicts(operation, currentState);
      
      if (conflictInfo.hasConflict) {
        // Release lock and return conflict info
        await this.releaseLock(lockKey, operationId);
        return {
          success: false,
          operationId,
          conflict: conflictInfo,
          suggestions: await this.generateConflictSuggestions(operation, conflictInfo)
        };
      }

      // Apply operation
      const result = await this.applyOperation(operation, currentState);
      
      // Update state in database
      await this.updateThreatModelState(operation.threatModelId, result);
      
      // Cache the operation for future conflict detection
      await this.cacheOperation(operation);
      
      // Release lock
      await this.releaseLock(lockKey, operationId);

      return {
        success: true,
        operationId,
        data: result
      };

    } catch (error) {
      logger.error('Operation processing error:', error);
      await this.releaseLock(lockKey, operationId);
      
      return {
        success: false,
        operationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async resolveConflict(
    operationId: string,
    resolution: 'accept' | 'reject' | 'merge',
    mergeData?: any
  ): Promise<OperationResult> {
    try {
      const operationData = await this.redis.get(`operation:${operationId}`);
      if (!operationData) {
        throw new Error('Operation not found');
      }

      const operation: ThreatModelOperation = JSON.parse(operationData);
      
      switch (resolution) {
        case 'accept':
          return await this.acceptConflictedOperation(operation);
        
        case 'reject':
          return await this.rejectConflictedOperation(operation);
        
        case 'merge':
          return await this.mergeConflictedOperation(operation, mergeData);
        
        default:
          throw new Error('Invalid resolution type');
      }
    } catch (error) {
      logger.error('Conflict resolution error:', error);
      return {
        success: false,
        operationId,
        error: error instanceof Error ? error.message : 'Resolution failed'
      };
    }
  }

  private async detectConflicts(
    operation: ThreatModelOperation,
    currentState: any
  ): Promise<ConflictInfo> {
    const conflictInfo: ConflictInfo = {
      hasConflict: false,
      type: 'none',
      conflictingElements: [],
      description: ''
    };

    // Check for different types of conflicts based on operation type
    switch (operation.type) {
      case 'create_component':
        return await this.detectComponentConflicts(operation, currentState);
      
      case 'update_component':
        return await this.detectUpdateConflicts(operation, currentState);
      
      case 'delete_component':
        return await this.detectDeleteConflicts(operation, currentState);
      
      case 'create_data_flow':
        return await this.detectDataFlowConflicts(operation, currentState);
      
      case 'update_data_flow':
        return await this.detectDataFlowUpdateConflicts(operation, currentState);
      
      case 'create_threat':
        return await this.detectThreatConflicts(operation, currentState);
      
      case 'update_threat':
        return await this.detectThreatUpdateConflicts(operation, currentState);
      
      default:
        return conflictInfo;
    }
  }

  private async detectComponentConflicts(
    operation: ThreatModelOperation,
    currentState: any
  ): Promise<ConflictInfo> {
    const { data } = operation;
    
    // Check if component already exists at the same position
    const existingComponent = currentState.components.find((comp: any) => 
      Math.abs(comp.position.x - data.position.x) < 50 && 
      Math.abs(comp.position.y - data.position.y) < 50
    );

    if (existingComponent) {
      return {
        hasConflict: true,
        type: 'position',
        conflictingElements: [existingComponent.id],
        description: `Component would overlap with existing component "${existingComponent.name}"`
      };
    }

    // Check for name conflicts
    const nameConflict = currentState.components.find((comp: any) => 
      comp.name.toLowerCase() === data.name.toLowerCase()
    );

    if (nameConflict) {
      return {
        hasConflict: true,
        type: 'name',
        conflictingElements: [nameConflict.id],
        description: `Component name "${data.name}" already exists`
      };
    }

    return { hasConflict: false, type: 'none', conflictingElements: [], description: '' };
  }

  private async detectUpdateConflicts(
    operation: ThreatModelOperation,
    currentState: any
  ): Promise<ConflictInfo> {
    const { data } = operation;
    
    // Check if component exists
    const component = currentState.components.find((comp: any) => comp.id === data.id);
    if (!component) {
      return {
        hasConflict: true,
        type: 'missing',
        conflictingElements: [data.id],
        description: `Component "${data.id}" no longer exists`
      };
    }

    // Check for concurrent modifications using version/timestamp
    if (component.lastModified > operation.timestamp) {
      return {
        hasConflict: true,
        type: 'concurrent_modification',
        conflictingElements: [data.id],
        description: `Component "${component.name}" was modified by another user`
      };
    }

    // Check for position conflicts if position is being updated
    if (data.position && data.position !== component.position) {
      const conflictingComponent = currentState.components.find((comp: any) => 
        comp.id !== data.id &&
        Math.abs(comp.position.x - data.position.x) < 50 && 
        Math.abs(comp.position.y - data.position.y) < 50
      );

      if (conflictingComponent) {
        return {
          hasConflict: true,
          type: 'position',
          conflictingElements: [conflictingComponent.id],
          description: `New position would overlap with component "${conflictingComponent.name}"`
        };
      }
    }

    return { hasConflict: false, type: 'none', conflictingElements: [], description: '' };
  }

  private async detectDeleteConflicts(
    operation: ThreatModelOperation,
    currentState: any
  ): Promise<ConflictInfo> {
    const { data } = operation;
    
    // Check if component is referenced by data flows
    const referencingFlows = currentState.dataFlows.filter((flow: any) => 
      flow.source === data.id || flow.destination === data.id
    );

    if (referencingFlows.length > 0) {
      return {
        hasConflict: true,
        type: 'dependency',
        conflictingElements: referencingFlows.map((flow: any) => flow.id),
        description: `Component is referenced by ${referencingFlows.length} data flow(s)`
      };
    }

    // Check if component has threats
    const componentThreats = currentState.threats.filter((threat: any) => 
      threat.affectedComponents.includes(data.id)
    );

    if (componentThreats.length > 0) {
      return {
        hasConflict: true,
        type: 'dependency',
        conflictingElements: componentThreats.map((threat: any) => threat.id),
        description: `Component has ${componentThreats.length} associated threat(s)`
      };
    }

    return { hasConflict: false, type: 'none', conflictingElements: [], description: '' };
  }

  private async detectDataFlowConflicts(
    operation: ThreatModelOperation,
    currentState: any
  ): Promise<ConflictInfo> {
    const { data } = operation;
    
    // Check if source and destination components exist
    const sourceExists = currentState.components.some((comp: any) => comp.id === data.source);
    const destExists = currentState.components.some((comp: any) => comp.id === data.destination);

    if (!sourceExists || !destExists) {
      return {
        hasConflict: true,
        type: 'missing',
        conflictingElements: [!sourceExists ? data.source : data.destination],
        description: `${!sourceExists ? 'Source' : 'Destination'} component no longer exists`
      };
    }

    // Check for duplicate data flows
    const duplicateFlow = currentState.dataFlows.find((flow: any) => 
      flow.source === data.source && 
      flow.destination === data.destination &&
      flow.name === data.name
    );

    if (duplicateFlow) {
      return {
        hasConflict: true,
        type: 'duplicate',
        conflictingElements: [duplicateFlow.id],
        description: `Data flow "${data.name}" already exists between these components`
      };
    }

    return { hasConflict: false, type: 'none', conflictingElements: [], description: '' };
  }

  private async detectDataFlowUpdateConflicts(
    operation: ThreatModelOperation,
    currentState: any
  ): Promise<ConflictInfo> {
    const { data } = operation;
    
    // Check if data flow exists
    const dataFlow = currentState.dataFlows.find((flow: any) => flow.id === data.id);
    if (!dataFlow) {
      return {
        hasConflict: true,
        type: 'missing',
        conflictingElements: [data.id],
        description: `Data flow "${data.id}" no longer exists`
      };
    }

    // Check for concurrent modifications
    if (dataFlow.lastModified > operation.timestamp) {
      return {
        hasConflict: true,
        type: 'concurrent_modification',
        conflictingElements: [data.id],
        description: `Data flow "${dataFlow.name}" was modified by another user`
      };
    }

    return { hasConflict: false, type: 'none', conflictingElements: [], description: '' };
  }

  private async detectThreatConflicts(
    operation: ThreatModelOperation,
    currentState: any
  ): Promise<ConflictInfo> {
    const { data } = operation;
    
    // Check if affected components exist
    const missingComponents = data.affectedComponents.filter((compId: string) => 
      !currentState.components.some((comp: any) => comp.id === compId)
    );

    if (missingComponents.length > 0) {
      return {
        hasConflict: true,
        type: 'missing',
        conflictingElements: missingComponents,
        description: `${missingComponents.length} affected component(s) no longer exist`
      };
    }

    // Check for duplicate threats
    const duplicateThreat = currentState.threats.find((threat: any) => 
      threat.name.toLowerCase() === data.name.toLowerCase() &&
      threat.affectedComponents.some((compId: string) => data.affectedComponents.includes(compId))
    );

    if (duplicateThreat) {
      return {
        hasConflict: true,
        type: 'duplicate',
        conflictingElements: [duplicateThreat.id],
        description: `Similar threat "${data.name}" already exists for these components`
      };
    }

    return { hasConflict: false, type: 'none', conflictingElements: [], description: '' };
  }

  private async detectThreatUpdateConflicts(
    operation: ThreatModelOperation,
    currentState: any
  ): Promise<ConflictInfo> {
    const { data } = operation;
    
    // Check if threat exists
    const threat = currentState.threats.find((t: any) => t.id === data.id);
    if (!threat) {
      return {
        hasConflict: true,
        type: 'missing',
        conflictingElements: [data.id],
        description: `Threat "${data.id}" no longer exists`
      };
    }

    // Check for concurrent modifications
    if (threat.lastModified > operation.timestamp) {
      return {
        hasConflict: true,
        type: 'concurrent_modification',
        conflictingElements: [data.id],
        description: `Threat "${threat.name}" was modified by another user`
      };
    }

    return { hasConflict: false, type: 'none', conflictingElements: [], description: '' };
  }

  private async generateConflictSuggestions(
    operation: ThreatModelOperation,
    conflictInfo: ConflictInfo
  ): Promise<string[]> {
    const suggestions: string[] = [];

    switch (conflictInfo.type) {
      case 'position':
        suggestions.push('Move the component to a different position');
        suggestions.push('Resize or relocate the conflicting component');
        break;
      
      case 'name':
        suggestions.push('Choose a different name for the component');
        suggestions.push('Add a suffix to make the name unique');
        break;
      
      case 'concurrent_modification':
        suggestions.push('Refresh the model to see latest changes');
        suggestions.push('Merge your changes with the latest version');
        suggestions.push('Apply your changes to the updated element');
        break;
      
      case 'dependency':
        suggestions.push('Remove or reassign dependent elements first');
        suggestions.push('Convert deletion to deactivation');
        break;
      
      case 'missing':
        suggestions.push('Refresh the model to see current state');
        suggestions.push('Create the missing element first');
        break;
      
      case 'duplicate':
        suggestions.push('Modify the existing element instead');
        suggestions.push('Choose a different name or configuration');
        break;
    }

    return suggestions;
  }

  private async applyOperation(
    operation: ThreatModelOperation,
    currentState: any
  ): Promise<any> {
    const newState = JSON.parse(JSON.stringify(currentState)); // Deep clone
    
    switch (operation.type) {
      case 'create_component':
        newState.components.push({
          ...operation.data,
          id: operation.data.id || this.generateId(),
          lastModified: operation.timestamp
        });
        break;
      
      case 'update_component':
        const compIndex = newState.components.findIndex((comp: any) => comp.id === operation.data.id);
        if (compIndex !== -1) {
          newState.components[compIndex] = {
            ...newState.components[compIndex],
            ...operation.data,
            lastModified: operation.timestamp
          };
        }
        break;
      
      case 'delete_component':
        newState.components = newState.components.filter((comp: any) => comp.id !== operation.data.id);
        break;
      
      case 'create_data_flow':
        newState.dataFlows.push({
          ...operation.data,
          id: operation.data.id || this.generateId(),
          lastModified: operation.timestamp
        });
        break;
      
      case 'update_data_flow':
        const flowIndex = newState.dataFlows.findIndex((flow: any) => flow.id === operation.data.id);
        if (flowIndex !== -1) {
          newState.dataFlows[flowIndex] = {
            ...newState.dataFlows[flowIndex],
            ...operation.data,
            lastModified: operation.timestamp
          };
        }
        break;
      
      case 'delete_data_flow':
        newState.dataFlows = newState.dataFlows.filter((flow: any) => flow.id !== operation.data.id);
        break;
      
      case 'create_threat':
        newState.threats.push({
          ...operation.data,
          id: operation.data.id || this.generateId(),
          lastModified: operation.timestamp
        });
        break;
      
      case 'update_threat':
        const threatIndex = newState.threats.findIndex((threat: any) => threat.id === operation.data.id);
        if (threatIndex !== -1) {
          newState.threats[threatIndex] = {
            ...newState.threats[threatIndex],
            ...operation.data,
            lastModified: operation.timestamp
          };
        }
        break;
      
      case 'delete_threat':
        newState.threats = newState.threats.filter((threat: any) => threat.id !== operation.data.id);
        break;
    }

    return newState;
  }

  private async acceptConflictedOperation(operation: ThreatModelOperation): Promise<OperationResult> {
    // Force apply the operation ignoring conflicts
    const currentState = await this.getCurrentState(operation.threatModelId);
    const result = await this.applyOperation(operation, currentState);
    await this.updateThreatModelState(operation.threatModelId, result);
    
    return {
      success: true,
      operationId: this.generateOperationId(),
      data: result
    };
  }

  private async rejectConflictedOperation(operation: ThreatModelOperation): Promise<OperationResult> {
    // Simply reject the operation
    return {
      success: false,
      operationId: this.generateOperationId(),
      error: 'Operation rejected by user'
    };
  }

  private async mergeConflictedOperation(
    operation: ThreatModelOperation,
    mergeData: any
  ): Promise<OperationResult> {
    // Apply operation with merged data
    const mergedOperation = {
      ...operation,
      data: { ...operation.data, ...mergeData }
    };

    const currentState = await this.getCurrentState(operation.threatModelId);
    const result = await this.applyOperation(mergedOperation, currentState);
    await this.updateThreatModelState(operation.threatModelId, result);
    
    return {
      success: true,
      operationId: this.generateOperationId(),
      data: result
    };
  }

  private async getCurrentState(threatModelId: string): Promise<any> {
    const result = await this.db.query(
      'SELECT model_data FROM threat_models WHERE id = $1',
      [threatModelId]
    );

    if (result.rows.length === 0) {
      throw new Error('Threat model not found');
    }

    return result.rows[0].model_data;
  }

  private async updateThreatModelState(threatModelId: string, newState: any): Promise<void> {
    await this.db.query(
      'UPDATE threat_models SET model_data = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(newState), threatModelId]
    );
  }

  private async cacheOperation(operation: ThreatModelOperation): Promise<void> {
    const key = `operation:${operation.threatModelId}:${operation.timestamp}`;
    await this.redis.setEx(key, 3600, JSON.stringify(operation)); // Cache for 1 hour
  }

  private async acquireLock(lockKey: string, operationId: string): Promise<boolean> {
    const result = await this.redis.set(lockKey, operationId, {
      PX: this.lockTimeout,
      NX: true
    });
    return result === 'OK';
  }

  private async releaseLock(lockKey: string, operationId: string): Promise<void> {
    // Use Lua script to ensure we only release our own lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    await this.redis.eval(script, {
      keys: [lockKey],
      arguments: [operationId]
    });
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
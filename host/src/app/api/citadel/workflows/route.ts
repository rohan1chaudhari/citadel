import { NextRequest, NextResponse } from 'next/server';
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
  getWorkflowExecutions,
  getAllWorkflowExecutions,
  getWorkflowStats,
  type WorkflowTrigger,
  type WorkflowCondition,
  type WorkflowAction,
} from '@citadel/core';

export const dynamic = 'force-dynamic';

/**
 * GET /api/citadel/workflows
 * List all workflows or get a specific one
 * 
 * Query params:
 * - id: specific workflow ID
 * - executions: include execution history (true/false)
 * - stats: include system stats (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const includeExecutions = searchParams.get('executions') === 'true';
    const includeStats = searchParams.get('stats') === 'true';
    
    // Get specific workflow
    if (id) {
      const workflowId = parseInt(id, 10);
      if (isNaN(workflowId)) {
        return NextResponse.json(
          { ok: false, error: 'Invalid workflow ID' },
          { status: 400 }
        );
      }
      
      const workflow = getWorkflow(workflowId);
      if (!workflow) {
        return NextResponse.json(
          { ok: false, error: 'Workflow not found' },
          { status: 404 }
        );
      }
      
      const result: Record<string, unknown> = { ok: true, workflow };
      
      if (includeExecutions) {
        result.executions = getWorkflowExecutions(workflowId);
      }
      
      return NextResponse.json(result);
    }
    
    // List all workflows
    const workflows = listWorkflows();
    const result: Record<string, unknown> = { ok: true, workflows };
    
    if (includeStats) {
      result.stats = getWorkflowStats();
    }
    
    if (includeExecutions) {
      result.recentExecutions = getAllWorkflowExecutions(20);
    }
    
    return NextResponse.json(result);
  } catch (err) {
    console.error('[workflows] GET error:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/citadel/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, trigger, conditions, actions, enabled } = body;
    
    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Workflow name is required' },
        { status: 400 }
      );
    }
    
    if (!trigger || typeof trigger !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Trigger configuration is required' },
        { status: 400 }
      );
    }
    
    if (!trigger.event || typeof trigger.event !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Trigger event is required' },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'At least one action is required' },
        { status: 400 }
      );
    }
    
    // Validate actions (max 3)
    if (actions.length > 3) {
      return NextResponse.json(
        { ok: false, error: 'Maximum 3 actions allowed per workflow' },
        { status: 400 }
      );
    }
    
    // Validate each action has an action property
    for (let i = 0; i < actions.length; i++) {
      if (!actions[i].action || typeof actions[i].action !== 'string') {
        return NextResponse.json(
          { ok: false, error: `Action ${i + 1} must have an action property` },
          { status: 400 }
        );
      }
    }
    
    const workflow = createWorkflow(name, trigger as WorkflowTrigger, actions as WorkflowAction[], {
      description,
      conditions: conditions as WorkflowCondition[] | undefined,
      enabled: enabled !== false, // default true
    });
    
    return NextResponse.json({ ok: true, workflow }, { status: 201 });
  } catch (err) {
    console.error('[workflows] POST error:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/citadel/workflows
 * Update a workflow
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, enabled, trigger, conditions, actions } = body;
    
    if (!id || typeof id !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'Workflow ID is required' },
        { status: 400 }
      );
    }
    
    // Validate actions if provided
    if (actions) {
      if (!Array.isArray(actions) || actions.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Actions must be a non-empty array' },
          { status: 400 }
        );
      }
      
      if (actions.length > 3) {
        return NextResponse.json(
          { ok: false, error: 'Maximum 3 actions allowed per workflow' },
          { status: 400 }
        );
      }
    }
    
    const updates: Parameters<typeof updateWorkflow>[1] = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (enabled !== undefined) updates.enabled = enabled;
    if (trigger !== undefined) updates.trigger = trigger as WorkflowTrigger;
    if (conditions !== undefined) updates.conditions = conditions as WorkflowCondition[];
    if (actions !== undefined) updates.actions = actions as WorkflowAction[];
    
    const workflow = updateWorkflow(id, updates);
    
    if (!workflow) {
      return NextResponse.json(
        { ok: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ ok: true, workflow });
  } catch (err) {
    console.error('[workflows] PATCH error:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/citadel/workflows
 * Delete a workflow
 * 
 * Query params:
 * - id: workflow ID to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Workflow ID is required' },
        { status: 400 }
      );
    }
    
    const workflowId = parseInt(id, 10);
    if (isNaN(workflowId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid workflow ID' },
        { status: 400 }
      );
    }
    
    const success = deleteWorkflow(workflowId);
    
    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'Workflow not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ ok: true, deleted: workflowId });
  } catch (err) {
    console.error('[workflows] DELETE error:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

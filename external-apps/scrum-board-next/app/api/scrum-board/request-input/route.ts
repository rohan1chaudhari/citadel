import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { ensureScrumBoardSchema, normalizeStatus } from '@/lib/scrumBoardSchema';

export const runtime = 'nodejs';
const APP_ID = 'scrum-board';

export async function POST(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  
  const taskId = Number(body?.taskId);
  const question = String(body?.question ?? '').trim();
  const options = body?.options;
  const sessionId = String(body?.session_id ?? '').trim() || null;
  const inputDeadlineAt = body?.input_deadline_at 
    ? new Date(body.input_deadline_at).toISOString() 
    : null;

  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ ok: false, error: 'question required' }, { status: 400 });
  }

  // Validate question length
  if (question.length > 1000) {
    return NextResponse.json({ ok: false, error: 'question too long (max 1000 chars)' }, { status: 400 });
  }

  // Check task exists
  const task = dbQuery<{
    id: number;
    status: string;
    needs_input_questions: string | null;
  }>(
    APP_ID,
    `SELECT id, status, needs_input_questions FROM tasks WHERE id = ? LIMIT 1`,
    [taskId]
  )[0];

  if (!task) {
    return NextResponse.json({ ok: false, error: 'task not found' }, { status: 404 });
  }

  // Parse existing questions
  let questions: Array<{
    id: string;
    question: string;
    options?: string[];
    asked_at: string;
    answered: boolean;
    answer?: string;
  }> = [];
  
  if (task.needs_input_questions) {
    try {
      questions = JSON.parse(task.needs_input_questions);
      if (!Array.isArray(questions)) questions = [];
    } catch {
      questions = [];
    }
  }

  // Add new question
  const newQuestion = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question,
    options: Array.isArray(options) ? options.filter((o: string) => typeof o === 'string' && o.length <= 200).slice(0, 10) : undefined,
    asked_at: new Date().toISOString(),
    answered: false,
  };
  
  questions.push(newQuestion);

  const now = new Date().toISOString();

  // Update task to needs_input status and store questions
  dbExec(
    APP_ID,
    `UPDATE tasks 
     SET status = ?, 
         needs_input_questions = ?, 
         session_id = COALESCE(?, session_id),
         input_deadline_at = COALESCE(?, input_deadline_at),
         updated_at = ?
     WHERE id = ?`,
    ['needs_input', JSON.stringify(questions), sessionId, inputDeadlineAt, now, taskId]
  );

  // Add system comment about the question
  const optionsText = newQuestion.options 
    ? `\n\nOptions:\n${newQuestion.options.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}`
    : '';
  
  const commentBody = `[AUTOPILOT_NEEDS_INPUT] ${question}${optionsText}`;
  dbExec(
    APP_ID,
    `INSERT INTO comments (task_id, body, created_at) VALUES (?, ?, ?)`,
    [taskId, commentBody, now]
  );

  return NextResponse.json({
    ok: true,
    taskId,
    questionId: newQuestion.id,
    status: 'needs_input',
    message: 'Input requested successfully',
  });
}

// GET endpoint to fetch all needs_input tasks (for inbox)
export async function GET(req: Request) {
  ensureScrumBoardSchema();
  
  const url = new URL(req.url);
  const appId = url.searchParams.get('app');
  
  // If appId provided, filter by that app; otherwise get all needs_input tasks
  let query: string;
  let params: (string | number)[];
  
  if (appId) {
    query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.needs_input_questions,
        t.input_deadline_at,
        t.session_id,
        t.created_at,
        t.updated_at,
        b.app_id as board_app_id
      FROM tasks t
      JOIN boards b ON t.board_id = b.id
      WHERE t.status = 'needs_input' AND b.app_id = ?
      ORDER BY 
        CASE t.priority 
          WHEN 'high' THEN 0 
          WHEN 'medium' THEN 1 
          ELSE 2 
        END,
        t.created_at DESC
    `;
    params = [appId];
  } else {
    query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.needs_input_questions,
        t.input_deadline_at,
        t.session_id,
        t.created_at,
        t.updated_at,
        b.app_id as board_app_id
      FROM tasks t
      JOIN boards b ON t.board_id = b.id
      WHERE t.status = 'needs_input'
      ORDER BY 
        CASE t.priority 
          WHEN 'high' THEN 0 
          WHEN 'medium' THEN 1 
          ELSE 2 
        END,
        t.created_at DESC
    `;
    params = [];
  }
  
  const tasks = dbQuery<{
    id: number;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    needs_input_questions: string | null;
    input_deadline_at: string | null;
    session_id: string | null;
    created_at: string;
    updated_at: string | null;
    board_app_id: string;
  }>(APP_ID, query, params);

  // Parse questions JSON for each task
  const parsedTasks = tasks.map(t => {
    let questions: Array<{
      id: string;
      question: string;
      options?: string[];
      asked_at: string;
      answered: boolean;
      answer?: string;
    }> = [];
    
    if (t.needs_input_questions) {
      try {
        questions = JSON.parse(t.needs_input_questions);
        if (!Array.isArray(questions)) questions = [];
      } catch {
        questions = [];
      }
    }
    
    // Only include unanswered questions
    const unansweredQuestions = questions.filter(q => !q.answered);
    
    return {
      ...t,
      questions: unansweredQuestions,
      questionCount: unansweredQuestions.length,
    };
  }).filter(t => t.questionCount > 0); // Only include tasks with unanswered questions

  return NextResponse.json({
    ok: true,
    tasks: parsedTasks,
    total: parsedTasks.length,
  });
}

// PATCH endpoint to answer a question
export async function PATCH(req: Request) {
  ensureScrumBoardSchema();
  const body = await req.json().catch(() => ({} as any));
  
  const taskId = Number(body?.taskId);
  const questionId = String(body?.questionId ?? '').trim();
  const answer = String(body?.answer ?? '').trim();

  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 });
  }
  if (!questionId) {
    return NextResponse.json({ ok: false, error: 'questionId required' }, { status: 400 });
  }
  if (!answer) {
    return NextResponse.json({ ok: false, error: 'answer required' }, { status: 400 });
  }

  // Get task
  const task = dbQuery<{
    id: number;
    needs_input_questions: string | null;
  }>(
    APP_ID,
    `SELECT id, needs_input_questions FROM tasks WHERE id = ? LIMIT 1`,
    [taskId]
  )[0];

  if (!task) {
    return NextResponse.json({ ok: false, error: 'task not found' }, { status: 404 });
  }

  // Parse and update questions
  let questions: Array<{
    id: string;
    question: string;
    options?: string[];
    asked_at: string;
    answered: boolean;
    answer?: string;
  }> = [];
  
  if (task.needs_input_questions) {
    try {
      questions = JSON.parse(task.needs_input_questions);
      if (!Array.isArray(questions)) questions = [];
    } catch {
      questions = [];
    }
  }

  const questionIndex = questions.findIndex(q => q.id === questionId);
  if (questionIndex === -1) {
    return NextResponse.json({ ok: false, error: 'question not found' }, { status: 404 });
  }

  questions[questionIndex].answered = true;
  questions[questionIndex].answer = answer;

  const now = new Date().toISOString();

  // Update task
  dbExec(
    APP_ID,
    `UPDATE tasks SET needs_input_questions = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(questions), now, taskId]
  );

  return NextResponse.json({
    ok: true,
    taskId,
    questionId,
    answered: true,
  });
}

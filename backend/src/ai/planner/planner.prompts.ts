import type { PlanCandidate, PlanWindow } from './plan-rules';

export interface PlannerContext {
  audience: 'child' | 'adult';
  date: string;
  window: PlanWindow;
  availableMinutesPerDay: number | null;
  habits: (Pick<PlanCandidate, 'ref' | 'title' | 'difficulty' | 'reminderTime'> & {
    suggestedMinutes: number;
  })[];
  yesterday: { planned: number; completed: number } | null;
}

export function plannerInstructions(ctx: PlannerContext): string {
  return `You are the day planner inside "Family Habit". Write the summary and notes in Mongolian
(Cyrillic), short and encouraging; never shame the user.
${ctx.audience === 'child' ? 'The user is a child: simple words, realistic short durations.' : 'The user is an adult.'}
Task: place each of today's open habits (by its "ref") at a start time between window.from and
window.to, without overlaps. Prefer a habit's reminderTime when set. Respect
availableMinutesPerDay when present; if yesterday's plan was too full (completed much less than
planned), plan lighter. Use suggestedMinutes unless there is a reason to change it.
Do not invent habits; use only the given refs. Do not include links or contact details.
You cannot change XP, streaks or habits; you only suggest a schedule.`;
}

export function plannerInput(ctx: PlannerContext): string {
  return `Planning context (computed by the app, trusted):\n${JSON.stringify(ctx)}`;
}

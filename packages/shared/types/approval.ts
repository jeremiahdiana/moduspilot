export type ApprovalType = 'create_goal' | 'create_task' | 'create_habit' | 'schedule_event';

export interface ApprovalCard {
  type: ApprovalType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

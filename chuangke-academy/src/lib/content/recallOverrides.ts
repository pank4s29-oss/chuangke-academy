export type RecallTargetOverride = {
  source_code: string;
  target_stage_key: string;
  target_task_key: string;
  target_field_key: string;
  updated_by?: string;
  updated_at?: string;
};

export function recallOverrideMap(rows: RecallTargetOverride[]) {
  return new Map(rows.map((row) => [row.source_code, row]));
}

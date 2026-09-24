import { notFound } from "next/navigation";
import TaskFlow from "@/components/TaskFlow";
import { course } from "@/lib/content/course";
import { readTaskSectionsWithFields, readTaskSectionsWithFieldsFromSources, applyQuestionOverrides } from "@/lib/content/taskSections";
import { createClient } from "@/lib/supabase/server";

type Props = { params: { workspaceId: string; courseKey: string; stageKey: string } };
type ContentVersion = { stage_id: string; content_json: unknown; version_number: number };

export default async function WorkspaceLearnPage({ params }: Props) {
  const stage = params.courseKey === course.key ? course.stages.find((item) => item.key === params.stageKey) : undefined;
  if (!stage) notFound();
  const stageIndex = course.stages.findIndex((item) => item.key === stage.key);
  const nextStageKey = course.stages[stageIndex + 1]?.key;
  const referenceKeys = [...new Set(["stage-01", "stage-02", stage.key])];
  const supabase = createClient();

  // Load all page configuration in parallel. Previously the overrides query
  // blocked the recall queries, and each reference stage made another pair of
  // sequential database round trips before the page could render.
  const [overrideResult, settingsResult, targetsResult, stageRowsResult] = await Promise.all([
    supabase.from("question_overrides").select("stage_key,task_key,field_key,prompt,description,options,field_type,multiple,sort_order,is_deleted,is_custom,table_key,table_title,table_row,table_column").in("stage_key", referenceKeys),
    supabase.from("recall_settings").select("stage_key,task_key,field_key,enabled,updated_by,updated_at"),
    supabase.from("recall_targets").select("stage_key,task_key,field_key,target_stage_key,target_task_key,target_field_key,position,updated_by,updated_at").order("position"),
    supabase.from("stages").select("id,stage_key").in("stage_key", referenceKeys),
  ]);

  const overrides = overrideResult.data ?? [];
  const stageRows = stageRowsResult.data ?? [];
  const stageIds = stageRows.map((row) => row.id);
  const { data: publishedRows } = stageIds.length
    ? await supabase.from("content_versions").select("stage_id,content_json,version_number").in("stage_id", stageIds).eq("status", "published").order("version_number", { ascending: false })
    : { data: [] as ContentVersion[] };
  const latestSourceByStage = new Map<string, string>();
  const stageKeyById = new Map(stageRows.map((row) => [row.id, row.stage_key]));
  for (const row of (publishedRows ?? []) as ContentVersion[]) {
    const key = stageKeyById.get(row.stage_id);
    const source = row.content_json && typeof row.content_json === "object" && "sourceMarkdown" in row.content_json
      ? (row.content_json as { sourceMarkdown?: string }).sourceMarkdown
      : undefined;
    if (key && source && !latestSourceByStage.has(key)) latestSourceByStage.set(key, source);
  }

  const loadTasks = (key: string) => {
    const source = latestSourceByStage.get(key);
    return source ? readTaskSectionsWithFieldsFromSources(key, source) : readTaskSectionsWithFields(key);
  };
  const tasksByStage = new Map(referenceKeys.map((key) => [key, applyQuestionOverrides(loadTasks(key), overrides)]));
  const tasks = tasksByStage.get(stage.key) ?? [];
  const referenceTasks = referenceKeys.flatMap((key) => tasksByStage.get(key) ?? []);

  return <TaskFlow stage={stage} courseKey={course.key} tasks={tasks} referenceTasks={referenceTasks} recallSettings={settingsResult.data ?? []} recallTargets={targetsResult.data ?? []} workspaceId={params.workspaceId} nextStageKey={nextStageKey} />;
}

import { notFound } from "next/navigation";
import TaskFlow from "@/components/TaskFlow";
import { course } from "@/lib/content/course";
import { readTaskSectionsWithFields, readTaskSectionsWithFieldsFromSources } from "@/lib/content/taskSections";
import { applyQuestionOverrides } from "@/lib/content/taskSections";
import { createClient } from "@/lib/supabase/server";

type Props = { params: { workspaceId: string; courseKey: string; stageKey: string } };

export default async function WorkspaceLearnPage({ params }: Props) {
  const stage = params.courseKey === course.key ? course.stages.find((item) => item.key === params.stageKey) : undefined;
  if (!stage) notFound();
  const stageIndex = course.stages.findIndex((item) => item.key === stage.key);
  const nextStageKey = course.stages[stageIndex + 1]?.key;
  const supabase = createClient();
  const overrideResult = await supabase.from("question_overrides").select("stage_key,task_key,field_key,prompt,description,options").in("stage_key", ["stage-01", "stage-02"]);
  const overrides = overrideResult.data ?? [];
  async function loadTasks(key: string) {
    const baseline = readTaskSectionsWithFields(key);
    const { data: stageRow } = await supabase.from("stages").select("id").eq("stage_key", key).maybeSingle();
    if (!stageRow) return baseline;
    const { data: published } = await supabase.from("content_versions").select("content_json").eq("stage_id", stageRow.id).eq("status", "published").order("version_number", { ascending: false }).limit(1).maybeSingle();
    const source = published?.content_json && typeof published.content_json === "object" && "sourceMarkdown" in published.content_json ? (published.content_json as { sourceMarkdown?: string }).sourceMarkdown : undefined;
    return source ? readTaskSectionsWithFieldsFromSources(key, source) : baseline;
  }
  const tasks = applyQuestionOverrides(await loadTasks(stage.key), overrides);
  const referenceTasks = (await Promise.all([...new Set(["stage-01", "stage-02", stage.key])].map(loadTasks))).flatMap((items) => applyQuestionOverrides(items, overrides));
  return <TaskFlow stage={stage} courseKey={course.key} tasks={tasks} referenceTasks={referenceTasks} workspaceId={params.workspaceId} nextStageKey={nextStageKey} />;
}

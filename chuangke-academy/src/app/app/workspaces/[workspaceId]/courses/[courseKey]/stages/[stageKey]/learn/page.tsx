import { notFound } from "next/navigation";
import TaskFlow from "@/components/TaskFlow";
import { course } from "@/lib/content/course";
import { readTaskSectionsWithFields } from "@/lib/content/taskSections";
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
  const tasks = applyQuestionOverrides(readTaskSectionsWithFields(stage.key), overrides);
  const referenceTasks = [...new Set(["stage-01", "stage-02", stage.key])].flatMap((key) => applyQuestionOverrides(readTaskSectionsWithFields(key), overrides));
  return <TaskFlow stage={stage} courseKey={course.key} tasks={tasks} referenceTasks={referenceTasks} workspaceId={params.workspaceId} nextStageKey={nextStageKey} />;
}

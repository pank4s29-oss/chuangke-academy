import { notFound } from "next/navigation";
import TaskFlow from "@/components/TaskFlow";
import { course } from "@/lib/content/course";
import { readTaskSectionsWithFields } from "@/lib/content/taskSections";

type Props = { params: { workspaceId: string; courseKey: string; stageKey: string } };

export default function WorkspaceLearnPage({ params }: Props) {
  const stage = params.courseKey === course.key ? course.stages.find((item) => item.key === params.stageKey) : undefined;
  if (!stage) notFound();
  const stageIndex = course.stages.findIndex((item) => item.key === stage.key);
  const nextStageKey = course.stages[stageIndex + 1]?.key;
  const tasks = readTaskSectionsWithFields(stage.key);
  const referenceTasks = [...new Set(["stage-01", "stage-02", stage.key])].flatMap((key) => readTaskSectionsWithFields(key));
  return <TaskFlow stage={stage} courseKey={course.key} tasks={tasks} referenceTasks={referenceTasks} workspaceId={params.workspaceId} nextStageKey={nextStageKey} />;
}

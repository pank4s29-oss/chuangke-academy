import { notFound } from "next/navigation";
import TaskFlow from "@/components/TaskFlow";
import { course } from "@/lib/content/course";
import { readTaskSectionsWithFields } from "@/lib/content/taskSections";

type Props = { params: { workspaceId: string; courseKey: string; stageKey: string } };

export default function WorkspaceLearnPage({ params }: Props) {
  const stage = params.courseKey === course.key ? course.stages.find((item) => item.key === params.stageKey) : undefined;
  if (!stage) notFound();
  return <TaskFlow stage={stage} courseKey={course.key} tasks={readTaskSectionsWithFields(stage.key)} workspaceId={params.workspaceId} />;
}

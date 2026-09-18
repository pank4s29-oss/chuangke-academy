import { notFound } from "next/navigation";
import TaskFlow from "@/components/TaskFlow";
import { course } from "@/lib/content/course";
import { readTaskSectionsWithFields } from "@/lib/content/taskSections";

type Props = { params: { courseKey: string; stageKey: string } };

export function generateStaticParams() {
  return course.stages.map((stage) => ({ courseKey: course.key, stageKey: stage.key }));
}

export default function LearnPage({ params }: Props) {
  const stage = params.courseKey === course.key ? course.stages.find((item) => item.key === params.stageKey) : undefined;
  if (!stage) notFound();
  return <TaskFlow stage={stage} courseKey={course.key} tasks={readTaskSectionsWithFields(stage.key)} />;
}

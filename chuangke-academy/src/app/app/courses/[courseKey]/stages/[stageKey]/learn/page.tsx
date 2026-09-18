import { notFound } from "next/navigation";
import StageWorkspace from "@/components/StageWorkspace";
import { course } from "@/lib/content/course";

type Props = { params: { courseKey: string; stageKey: string } };

export function generateStaticParams() {
  return course.stages.map((stage) => ({ courseKey: course.key, stageKey: stage.key }));
}

export default function LearnPage({ params }: Props) {
  const stage = params.courseKey === course.key ? course.stages.find((item) => item.key === params.stageKey) : undefined;
  if (!stage) notFound();
  return <StageWorkspace stage={stage} courseKey={course.key} />;
}

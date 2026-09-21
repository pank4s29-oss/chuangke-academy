import { redirect } from "next/navigation";
import { course } from "@/lib/content/course";

type Props = { params: { courseKey: string; stageKey: string } };

export function generateStaticParams() {
  return course.stages.map((stage) => ({ courseKey: course.key, stageKey: stage.key }));
}

export default function LearnPage({ params }: Props) {
  if (params.courseKey !== course.key || !course.stages.some((stage) => stage.key === params.stageKey)) redirect("/app");
  redirect("/app");
}

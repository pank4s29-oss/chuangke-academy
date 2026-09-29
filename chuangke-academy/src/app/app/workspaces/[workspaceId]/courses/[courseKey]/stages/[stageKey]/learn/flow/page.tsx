import { notFound, redirect } from "next/navigation";
import FlowRunner from "@/components/flow/FlowRunner";
import { course } from "@/lib/content/course";
import { loadStageFlow } from "@/lib/flow/load";

type Props = { params: { workspaceId: string; courseKey: string; stageKey: string } };

// Feature-flagged (D-03): the old /learn route and TaskFlow are untouched. Enable with NEXT_PUBLIC_FLOW_MODE=1.
export default function WorkspaceFlowPage({ params }: Props) {
  if (process.env.NEXT_PUBLIC_FLOW_MODE !== "1") notFound();
  const stage = params.courseKey === course.key ? course.stages.find((s) => s.key === params.stageKey) : undefined;
  if (!stage) notFound();
  const base = `/app/workspaces/${params.workspaceId}/courses/${params.courseKey}/stages/${params.stageKey}`;
  const flow = loadStageFlow(params.stageKey);
  if (!flow) redirect(`${base}/learn`); // no flow.yaml → old TaskFlow
  const next = course.stages[course.stages.findIndex((s) => s.key === stage.key) + 1]?.key;
  return <FlowRunner spec={flow.spec} lectures={flow.lectures} stageKey={stage.key} courseKey={params.courseKey} workspaceId={params.workspaceId} learnHref={`${base}/learn`} nextHref={next ? `/app/workspaces/${params.workspaceId}/courses/${params.courseKey}/stages/${next}/learn` : "/app"} />;
}

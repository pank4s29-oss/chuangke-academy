import TeacherDashboard from "@/components/TeacherDashboard";
import { course } from "@/lib/content/course";
import { readTaskSectionsWithFields } from "@/lib/content/taskSections";

export const metadata = { title: "教師批改後台｜創客學院" };

export default function TeacherPage() {
  const stageTasks = Object.fromEntries(course.stages.map((stage) => [stage.key, readTaskSectionsWithFields(stage.key)]));
  const stageTitles = Object.fromEntries(course.stages.map((stage) => [stage.key, stage.title]));
  const optionLabels = Object.fromEntries(course.stages.flatMap((stage) => stageTasks[stage.key].flatMap((task) => task.fields.flatMap((field) => (field.options ?? []).map((option) => [option.key, option.label])))));
  return <TeacherDashboard optionLabels={optionLabels} stageTitles={stageTitles} stageTasks={stageTasks} />;
}

import { writeFileSync } from "node:fs";
import { getAssignmentFields, readTaskSections } from "../../src/lib/content/taskSections";

for (const stageKey of ["stage-01", "stage-02"]) {
  const tasks = readTaskSections(stageKey).map((task) => ({
    key: task.key,
    title: task.title,
    fields: getAssignmentFields(task.assignment, task.key),
  }));
  writeFileSync(`docs/flow/baseline/${stageKey}.fields.json`, JSON.stringify(tasks, null, 2) + "\n");
}

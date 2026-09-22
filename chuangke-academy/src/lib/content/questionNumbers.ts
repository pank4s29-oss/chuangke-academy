import type { AssignmentField } from "./taskSections";

/**
 * Returns one visible number per answer block. A table is one question block
 * even when it contains many cells, and stage 2 portrait groups are one block.
 */
export function getQuestionNumbers(fields: AssignmentField[]) {
  const numbers: Record<string, number> = {};
  const seen = new Map<string, number>();
  let next = 0;
  fields.filter((field) => !field.hiddenInGroup).forEach((field) => {
    const blockKey = field.layout === "table"
      ? `table:${field.group ?? "表格作答"}`
      : /^stage-02-2-2-/.test(field.key) && /^第 [1-3] 格：/.test(field.group ?? "")
        ? `portrait:${field.group}`
        : `field:${field.key}`;
    let number = seen.get(blockKey);
    if (!number) {
      number = ++next;
      seen.set(blockKey, number);
    }
    numbers[field.key] = number;
  });
  return numbers;
}

import type { AssignmentField } from "./taskSections";

/** One answer block can span several `AssignmentField`s (every cell of a
 *  table row, or every box of a stage-2 portrait group) that should still
 *  read as a single numbered question. Shared by `getQuestionNumbers` and by
 *  the cross-reference resolver in RecallMarkdown, so "which block is this
 *  field part of" is answered the same way everywhere. */
export function blockKeyForField(field: AssignmentField) {
  if (field.layout === "table") return `table:${field.group ?? "表格作答"}`;
  if (/^stage-02-2-2-/.test(field.key) && /^第 [1-3] 格：/.test(field.group ?? "")) return `portrait:${field.group}`;
  return `field:${field.key}`;
}

/**
 * Returns one visible number per answer block. A table is one question block
 * even when it contains many cells, and stage 2 portrait groups are one block.
 */
export function getQuestionNumbers(fields: AssignmentField[]) {
  const numbers: Record<string, number> = {};
  const seen = new Map<string, number>();
  let next = 0;
  fields.filter((field) => !field.hiddenInGroup).forEach((field) => {
    const blockKey = blockKeyForField(field);
    let number = seen.get(blockKey);
    if (!number) {
      number = ++next;
      seen.set(blockKey, number);
    }
    numbers[field.key] = number;
  });
  return numbers;
}

import type { AssignmentField } from "./taskSections";

function isTableRow(line: string) { return /^\s*\|.*\|\s*$/.test(line); }
function tableCells(line: string) { return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()); }
function isSeparatorRow(line: string) { return isTableRow(line) && tableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell)); }
function isHeadingLine(line: string) { return /^#{1,6}\s/.test(line.trim()); }
function isStructuralBoundary(line: string) { return isHeadingLine(line) || /^[-*_]{3,}\s*$/.test(line.trim()) || /^\s*>/.test(line); }
function clean(value: string) { return value.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/☐|☑|☒|✅|✔|\[[xX ]\]/g, "").replace(/＿＿+|_{4,}/g, "").replace(/\s+/g, " ").trim(); }
function optionLabel(label: string) { return clean(label).replace(/^\s*[A-D][.、]\s*/, "").trim(); }
function optionPrefixes(label: string) {
  const value = optionLabel(label);
  return [value, value.split(/[：:——-]/)[0].trim()].filter((item, index, all) => item.length > 0 && all.indexOf(item) === index);
}
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function checkedMarker(line: string) { return /☑|☒|\[[xX]\]|✅|✔/.test(line); }
function optionChecked(line: string, label: string) {
  if (!checkedMarker(line)) return false;
  const plain = line.replace(/\*\*/g, "");
  return optionPrefixes(label).some((prefix) => new RegExp(`(?:☑|☒|\\[[xX]\\]|✅|✔)\\s*(?:[A-D][.、]\\s*)?${escapeRegex(prefix)}`).test(plain));
}

function optionMentionedAsAnswer(line: string, label: string) {
  if (checkedMarker(line)) return false;
  const value = clean(line);
  return (isTableRow(line) || /^[-*]\s*\*\*/.test(line) || /^\*\*[^*]+[:：]/.test(line)) && optionPrefixes(label).some((prefix) => value.includes(prefix));
}

function tableValueForField(lines: string[], field: AssignmentField) {
  if (!field.tableRow) return null;
  for (let rowIndex = 0; rowIndex < lines.length; rowIndex += 1) {
    if (!isTableRow(lines[rowIndex])) continue;
    const cells = tableCells(lines[rowIndex]);
    if (!cells.some((cell) => clean(cell) === clean(field.tableRow ?? ""))) continue;
    const headerIndex = rowIndex > 1 && isSeparatorRow(lines[rowIndex - 1]) ? rowIndex - 2 : rowIndex - 1;
    const header = headerIndex >= 0 && isTableRow(lines[headerIndex]) ? tableCells(lines[headerIndex]) : [];
    if (field.type === "checkboxes" && field.options?.length) {
      if (field.tableColumn && field.tableColumn !== "選擇" && !header.some((cell) => clean(cell) === clean(field.tableColumn ?? ""))) continue;
      for (const option of field.options) {
        if (cells.some((cell) => optionChecked(cell, option.label) || clean(cell) === optionLabel(option.label))) return option.key;
      }
      continue;
    }
    const index = header.findIndex((cell) => clean(cell) === clean(field.tableColumn ?? "答案"));
    if (index < 0) continue;
    const value = cells[index] ?? "";
    if (value && !/^(＿＿+|_{4,})$/.test(value)) return clean(value);
  }
  return null;
}

/** Extract only evidence present in the uploaded work. Ambiguous content stays
 * blank so the teacher can verify it instead of silently importing a wrong answer. */
export function extractImportedAnswers(source: string, fields: AssignmentField[]) {
  const lines = source.split(/\r?\n/);
  const answers: Record<string, string | string[]> = {};
  for (const field of fields) {
    if (field.layout === "table" && field.tableRow) {
      const tableValue = tableValueForField(lines, field);
      if (tableValue !== null) answers[field.key] = field.type === "checkboxes" ? [tableValue] : tableValue;
      continue;
    }
    if (field.type === "checkboxes") {
      const selected = (field.options ?? []).filter((option) => lines.some((line) => optionChecked(line, option.label) || optionMentionedAsAnswer(line, option.label))).map((option) => option.key);
      if (selected.length) answers[field.key] = field.multiple ? selected : [selected[0]];
      for (const option of field.options ?? []) {
        if (!option.otherInputKey) continue;
        const line = lines.find((item) => optionChecked(item, option.label));
        if (!line) continue;
        const detail = clean(line.split(/[：:＝=]/).slice(1).join(":")).replace(optionLabel(option.label), "").trim();
        if (detail) answers[option.otherInputKey] = detail;
      }
      continue;
    }
    const prompt = field.prompt.split("＿＿＿＿")[0].replace(/[：:]\s*$/, "").trim();
    const lineIndex = lines.findIndex((line) => prompt && clean(line).includes(clean(prompt)));
    if (lineIndex < 0) continue;
    const sameLine = clean(lines[lineIndex].split(/[：:＝=]/).slice(1).join("："));
    const nextLine = lines.slice(lineIndex + 1).find((line) => line.trim() && !isStructuralBoundary(line));
    const value = sameLine || clean(nextLine ?? "");
    if (value && !/^(請填寫|你的答案|答案|作答)$/.test(value)) answers[field.key] = value;
  }
  return answers;
}

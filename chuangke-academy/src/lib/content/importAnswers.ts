import type { AssignmentField } from "./taskSections";

function isTableRow(line: string) { return /^\s*\|.*\|\s*$/.test(line); }
function tableCells(line: string) { return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()); }
function cleanText(value: string) { return value.replace(/\*\*(.+?)\*\*/g, "$1").replace(/＿＿+|_{4,}/g, "").replace(/\s+/g, " ").trim(); }
function isHeadingLine(line: string) { return /^#{1,6}\s/.test(line.trim()); }
function isStructuralBoundary(line: string) { return isHeadingLine(line) || /^[-*_]{3,}\s*$/.test(line.trim()) || /^\s*>/.test(line); }
function normalizedLine(line: string) { return line.replace(/\*\*/g, "").replace(/__/g, ""); }
function optionMatches(line: string, label: string) {
  const normalized = normalizedLine(line);
  const cleanLabel = optionLabelText(label);
  const shortLabel = cleanLabel.split(/[：:]/)[0].trim();
  return normalized.includes(cleanLabel) || (shortLabel.length >= 2 && normalized.includes(shortLabel));
}
function optionLabelText(label: string) { return label.replace(/\s+/g, " ").replace(/^\s*[A-D][.、]\s*/, "").trim(); }
function findTableCell(lines: string[], field: AssignmentField) {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!isTableRow(lines[index]) || !isTableRow(lines[index + 1]) || !/^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) continue;
    const headers = tableCells(lines[index]);
    let cursor = index + 2;
    while (cursor < lines.length && isTableRow(lines[cursor])) {
      const cells = tableCells(lines[cursor]);
      if (cleanText(cells[0] ?? "") === cleanText(field.tableRow ?? "")) {
        const columnIndex = headers.findIndex((header) => cleanText(header) === cleanText(field.tableColumn ?? "答案"));
        if (columnIndex >= 0) return cells[columnIndex] ?? "";
        const fallbackIndex = Math.max(0, headers.findIndex((header) => cleanText(header) === "答案"));
        if (field.tableColumn === "選擇" && fallbackIndex >= 0) return cells[fallbackIndex] ?? "";
      }
      cursor += 1;
    }
    index = cursor - 1;
  }
  return "";
}

export function extractImportedAnswers(source: string, fields: AssignmentField[]) {
  const lines = source.split(/\r?\n/);
  const answers: Record<string, string | string[]> = {};
  const checked = (line: string) => /(?:☑|☒|\[[xX]\])/.test(line);
  const active = (field: AssignmentField) => {
    if (!field.dependsOn) return true;
    const value = answers[field.dependsOn.fieldKey];
    return Array.isArray(value) ? value.includes(field.dependsOn.optionKey) : value === field.dependsOn.optionKey;
  };
  for (const field of fields) {
    if (field.hiddenInGroup || !active(field)) continue;
    if (field.type === "checkboxes") {
      const selectedOptions = (field.options ?? []).filter((option) => lines.some((line) => optionMatches(line, option.label) && (checked(line) || normalizedLine(line).includes(normalizedLine(field.prompt)))));
      const selected = selectedOptions.map((option) => option.key);
      if (selected.length) answers[field.key] = field.multiple ? selected : [selected[0]];
      selectedOptions.forEach((option) => {
        if (!option.otherInputKey) return;
        const line = lines.find((item) => optionMatches(item, option.label) && (checked(item) || normalizedLine(item).includes(normalizedLine(field.prompt))));
        const detail = line?.split(/[：:＝=]/).slice(1).join(":").trim();
        if (detail) answers[option.otherInputKey] = detail;
      });
      continue;
    }
    if (field.layout === "table" && field.tableRow) {
      const value = findTableCell(lines, field).replace(/☐|☑|☒|\[[xX ]\]/g, "").trim();
      if (value && !/^(＿＿+|_{4,})$/.test(value)) answers[field.key] = value;
      continue;
    }
    const prompt = field.prompt.split("＿＿＿＿")[0].replace(/[：:]\s*$/, "").trim();
    const lineIndex = lines.findIndex((line) => prompt && line.includes(prompt));
    if (lineIndex >= 0) {
      const sameLine = lines[lineIndex].split(/[：:＝=]/).slice(1).join("：").replace(/＿＿+|_{4,}/g, "").trim();
      const nextLine = lines.slice(lineIndex + 1).find((line) => line.trim() && !isStructuralBoundary(line));
      const value = sameLine || (nextLine ?? "").trim();
      if (value && !/^(請填寫|你的答案|答案)$/.test(value)) answers[field.key] = value;
    }
  }
  return answers;
}

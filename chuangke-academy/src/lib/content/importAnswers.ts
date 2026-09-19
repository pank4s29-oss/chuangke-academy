import type { AssignmentField } from "./taskSections";

function isTableRow(line: string) { return /^\s*\|.*\|\s*$/.test(line); }
function tableCells(line: string) { return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()); }
function cleanText(value: string) { return value.replace(/\*\*(.+?)\*\*/g, "$1").replace(/＿＿+|_{4,}/g, "").replace(/\s+/g, " ").trim(); }
function isHeadingLine(line: string) { return /^#{1,6}\s/.test(line.trim()); }
function isStructuralBoundary(line: string) { return isHeadingLine(line) || /^[-*_]{3,}\s*$/.test(line.trim()) || /^\s*>/.test(line); }

/** Browser-safe extraction for teacher-uploaded Markdown/TXT. It deliberately
 * imports only checked options and non-empty answers, leaving uncertain cells
 * blank for the teacher to verify in the review screen. */
export function extractImportedAnswers(source: string, fields: AssignmentField[]) {
  const lines = source.split(/\r?\n/);
  const answers: Record<string, string | string[]> = {};
  const checked = (line: string) => /(?:☑|☒|\[[xX]\])/.test(line);
  const optionLabel = (label: string) => label.replace(/\s+/g, " ").replace(/^\s*[A-D][.、]\s*/, "").trim();
  for (const field of fields) {
    if (field.hiddenInGroup) continue;
    if (field.type === "checkboxes") {
      const selectedOptions = (field.options ?? []).filter((option) => lines.some((line) => checked(line) && line.includes(optionLabel(option.label))));
      const selected = selectedOptions.map((option) => option.key);
      if (selected.length) answers[field.key] = field.multiple ? selected : [selected[0]];
      selectedOptions.forEach((option) => {
        if (!option.otherInputKey) return;
        const line = lines.find((item) => checked(item) && item.includes(optionLabel(option.label)));
        const detail = line?.split(/[：:＝=]/).slice(1).join(":").trim();
        if (detail) answers[option.otherInputKey] = detail;
      });
      continue;
    }
    if (field.layout === "table" && field.tableRow) {
      const tableStart = lines.findIndex((line, index) => isTableRow(line) && tableCells(line).some((cell) => cleanText(cell) === cleanText(field.tableRow ?? "")) && index > 0);
      if (tableStart >= 0) {
        let tableTop = tableStart;
        while (tableTop > 0 && isTableRow(lines[tableTop - 1])) tableTop -= 1;
        const headers = tableCells(lines[tableTop] ?? "");
        const cells = tableCells(lines[tableStart]);
        const columnIndex = Math.max(0, headers.findIndex((header) => cleanText(header) === cleanText(field.tableColumn ?? "答案")));
        const value = (cells[columnIndex] ?? "").replace(/☐|☑|☒|\[[xX ]\]/g, "").trim();
        if (value && !/^(＿＿+|_{4,})$/.test(value)) answers[field.key] = value;
      }
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

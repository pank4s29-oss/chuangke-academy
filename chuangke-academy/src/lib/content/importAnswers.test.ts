import { describe, expect, it } from "vitest";
import { extractImportedAnswers } from "./importAnswers";
import { getAssignmentFields } from "./taskSections";

describe("teacher assignment import", () => {
  it("maps checked options and inline other text", () => {
    const fields = getAssignmentFields("你目前的狀態\n☐ A. 已完成\n☐ 其他：____", "task");
    const other = fields.find((field) => field.hiddenInGroup);
    const source = "你目前的狀態\n☑ A. 已完成\n☑ 其他：目前正在測試";
    const answers = extractImportedAnswers(source, fields);
    expect(answers[fields[0].key]).toEqual([fields[0].options?.[0].key, fields[0].options?.[1].key]);
    expect(other).toBeDefined();
    expect(answers[other!.key]).toBe("目前正在測試");
  });

  it("maps a filled table cell to its field", () => {
    const fields = getAssignmentFields("| 項目 | 原話 |\n|---|---|\n| 1 | ＿＿＿＿ |", "task");
    const answers = extractImportedAnswers("| 項目 | 原話 |\n|---|---|\n| 1 | 我希望更快完成 |", fields);
    expect(answers[fields[0].key]).toBe("我希望更快完成");
  });

  it("reads an answer written as a blockquote line, instead of skipping past it into an unrelated checkpoint/checklist note below", () => {
    const template = [
      "**你的答案：**",
      "",
      "我服務的是【＿＿＿＿＿＿＿＿＿＿＿＿】的【＿＿＿＿＿＿＿＿】。",
      "",
      "**檢查點：** 這句話有沒有超過 25 個字？",
    ].join("\n");
    const fields = getAssignmentFields(template, "task");
    const filled = [
      "**你的答案：**",
      "",
      "> 我服務的是【想多一份收入的上班族】的【全職媽媽】。",
      "",
      "**檢查點：25 字，剛好通過。**",
    ].join("\n");
    const answers = extractImportedAnswers(filled, fields);
    for (const field of fields) {
      const value = answers[field.key];
      expect(typeof value === "string" ? value : "").not.toContain("檢查點");
    }
    expect(answers[fields[0].key]).toContain("想多一份收入的上班族");
  });

  it("does not let a checklist item (☑ ...) meant for a different field become another field's answer", () => {
    const template = ["我以前也【＿＿＿＿＿＿＿＿＿＿】，後來我【＿＿＿＿＿＿＿＿＿＿】。", "", "## 完成標準", "", "☐ 三句話加起來未超過 80 字"].join("\n");
    const fields = getAssignmentFields(template, "task");
    const filled = [
      "> 我以前也【是完全沒有美業背景、從零開始學的】，",
      "> 後來我【一支一支練，做到現在二十年】。",
      "",
      "## 完成標準",
      "",
      "☑ 三句話加起來未超過 80 字",
    ].join("\n");
    const answers = extractImportedAnswers(filled, fields);
    for (const field of fields) {
      const value = answers[field.key];
      expect(typeof value === "string" ? value : "").not.toContain("完成標準");
      expect(typeof value === "string" ? value : "").not.toContain("三句話加起來");
    }
  });

  it("skips an unfilled template blank and keeps looking for a later, actually-filled occurrence of the same prompt", () => {
    const template = ["**今天是：** ＿＿ 月 ＿＿ 日", "", "**往後數 30 天，我的第一版上線日是：** ＿＿ 月 ＿＿ 日"].join("\n");
    const fields = getAssignmentFields(template, "task");
    // only the second date was actually filled in; the first is untouched
    const filled = ["**今天是：** ＿＿ 月 ＿＿ 日", "", "**往後數 30 天，我的第一版上線日是：** 3 月 20 日"].join("\n");
    const answers = extractImportedAnswers(filled, fields);
    const today = fields.find((f) => f.prompt.startsWith("今天是"));
    expect(answers[today!.key]).toBeUndefined();
  });
});

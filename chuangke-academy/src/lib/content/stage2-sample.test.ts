import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractImportedAnswersForStage } from "./importAnswers";
import { readStageTasks } from "./taskSections";

const sample = fs.readFileSync(path.join(process.cwd(), "src/lib/content/fixtures/stage-02-sample-misty-brows.md"), "utf8");

describe("階段二霧眉範例校準", () => {
  it("2.1 依照原文先顯示開始前題目，再顯示分類與競品表格", () => {
    const fields = readStageTasks("stage-02")[0].fields.filter((field) => !field.hiddenInGroup);
    expect(fields[0].prompt).toBe("我以為學員會說的");
    expect(fields[0].multiple).toBe(false);
    expect(fields[1].prompt).toContain("抄 1.1-B 步驟 2");
    expect(fields[1].dependsOn?.optionLabel).toContain("最早寫的那一版");
    expect(fields[2].dependsOn?.optionLabel).toContain("已經改掉了");
    expect(fields[3].dependsOn?.optionLabel).toContain("已經改掉了");
    expect(fields[0].group).toContain("我以為學員會說的");
    expect(fields.findIndex((field) => field.group?.startsWith("2.1-B"))).toBeGreaterThan(fields.findIndex((field) => field.prompt.startsWith("恐懼那一格")));
  });

  it("能讀取範例的競品三列答案，不把表格列號當成題目", () => {
    const task = readStageTasks("stage-02")[0];
    const answers = extractImportedAnswersForStage(sample, [task]);
    const competitorFields = task.fields.filter((field) => field.group?.startsWith("2.1-B") && field.tableColumn === "賣給誰");
    expect(competitorFields.map((field) => field.tableRow)).toEqual(["競品 1", "競品 2", "競品 3"]);
    expect(answers[competitorFields[0].key]).toContain("想在家接客");
    expect(answers[competitorFields[1].key]).toContain("下班時間");
    expect(answers[competitorFields[2].key]).toContain("時間自由");
  });
});

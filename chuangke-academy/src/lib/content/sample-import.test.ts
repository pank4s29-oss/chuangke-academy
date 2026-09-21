import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractImportedAnswers } from "./importAnswers";
import { readStageTasks } from "./taskSections";

describe("霧眉教學學員作業範例", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/lib/content/fixtures/stage-01-sample-misty-brows.md"), "utf8");

  it("辨識任務 1 的 A 客群、④ 痛點、無經驗與經歷型定位", () => {
    const task = readStageTasks("stage-01")[0];
    const answers = extractImportedAnswers(source, task.fields);
    const optionLabels = (key: string) => task.fields.find((field) => field.key === key)?.options?.filter((option) => (answers[key] as string[] | undefined)?.includes(option.key)).map((option) => option.label);
    expect(optionLabels("stage-01-1-answer-0")).toEqual(["A. 還沒動作"]);
    expect(optionLabels("stage-01-1-answer-4")).toEqual(["④ 我不知道從哪裡開始"]);
    expect(optionLabels("stage-01-1-answer-12")).toEqual(["沒有。 他第一次認真找這類服務，大概還在自己想辦法"]);
    expect(optionLabels("stage-01-1-answer-13")).toEqual(["A 經歷型：我也走過同一條路"]);
  });

  it("辨識任務 3 的表格是非答案與任務 4 的女性受眾選項", () => {
    const task3 = readStageTasks("stage-01")[2];
    const answers3 = extractImportedAnswers(source, task3.fields);
    expect(answers3["stage-01-3-answer-8"]).toEqual(["stage-01-3-option-8-3"]);
    expect(answers3["stage-01-3-answer-13"]).toEqual(["stage-01-3-option-13-3"]);
    const task4 = readStageTasks("stage-01")[3];
    const answers4 = extractImportedAnswers(source, task4.fields);
    const gender = task4.fields.find((field) => field.key === "stage-01-4-answer-4");
    expect(gender?.options?.find((option) => (answers4[gender.key] as string[] | undefined)?.includes(option.key))?.label).toBe("女性居多");
  });
});

import { describe, expect, it } from "vitest";
import { extractImportedAnswers } from "./importAnswers";
import { readStageTasks } from "./taskSections";

describe("階段一任務二表格分組", () => {
  it("將 10 句原話、3 個競爭者與 3 個破口分成不同作答群組", () => {
    const task = readStageTasks("stage-01")[1];
    const tableFields = task.fields.filter((field) => field.layout === "table");
    const groups = new Set(tableFields.map((field) => field.group));
    expect(groups.size).toBeGreaterThanOrEqual(3);
    expect([...groups].some((group) => group?.includes("原話"))).toBe(true);
    expect([...groups].some((group) => group?.includes("競爭者名稱"))).toBe(true);
    expect([...groups].some((group) => group?.includes("別人的方案"))).toBe(true);
  });

  it("同樣的列號 1 在不同表格只填入自己的欄位", () => {
    const task = readStageTasks("stage-01")[1];
    const source = [
      "| # | 原話（照抄） | 從哪看到的 |",
      "|---|---|---|",
      "| 1 | 一句真實原話 | 討論區 |",
      "",
      "| # | 競爭者名稱 | 刊登多久 | 他在賣什麼 |",
      "|---|---|---|---|",
      "| 1 | 美甲教學 | 3 個月以上 | 入門技術班 |",
      "",
      "| # | 別人的方案，哪裡不夠好 | 我可以怎麼做得比他好 |",
      "|---|---|---|",
      "| 1 | 主打輕鬆好賺 | 一開始講清楚要練多久 |",
    ].join("\n");
    const fields = task.fields.filter((field) => field.layout === "table");
    const answers = extractImportedAnswers(source, fields);
    const quote = fields.find((field) => field.tableRow === "1" && field.tableColumn === "原話（照抄）");
    const competitor = fields.find((field) => field.tableRow === "1" && field.tableColumn === "競爭者名稱");
    const gap = fields.find((field) => field.tableRow === "1" && field.tableColumn === "別人的方案，哪裡不夠好");
    expect(answers[quote!.key]).toBe("一句真實原話");
    expect(answers[competitor!.key]).toBe("美甲教學");
    expect(answers[gap!.key]).toBe("主打輕鬆好賺");
  });
});

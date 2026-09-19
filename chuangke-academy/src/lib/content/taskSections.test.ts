import { describe, expect, it } from "vitest";
import { getAssignmentFields } from "./taskSections";

describe("getAssignmentFields", () => {
  it("keeps every option in a checkbox group even when each option has its own description line", () => {
    const md = [
      "**勾出你想服務的那一步（只能勾一個）：**",
      "",
      "☐ **A. 還沒動作**",
      "　他覺得困擾，但還沒真的做什麼。",
      "",
      "☐ **B. 自己想辦法**",
      "　查資料、看免費教學、問朋友、自己摸索。",
      "",
      "☐ **C. 花過錢找別人解決，但沒解決**",
      "　已經付錢給別人試過了，但沒得到他要的結果。",
      "",
      "☐ **D. 已經有結果，想要更好**",
      "　現在的狀況還可以，只是想再往上一階。",
      "",
      "---",
    ].join("\n");

    const fields = getAssignmentFields(md, "t");
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe("checkboxes");
    expect(fields[0].multiple).toBe(false);
    expect(fields[0].options?.map((o) => o.label)).toEqual([
      "A. 還沒動作",
      "B. 自己想辦法",
      "C. 花過錢找別人解決，但沒解決",
      "D. 已經有結果，想要更好",
    ]);
  });

  it("splits a line with several blanks into one field per blank instead of collapsing them", () => {
    const md = "我服務的是【＿＿＿＿＿＿＿＿＿＿＿＿】的【＿＿＿＿＿＿＿＿】。";
    const fields = getAssignmentFields(md, "t");
    expect(fields).toHaveLength(2);
    expect(fields.every((f) => f.type === "text")).toBe(true);
  });

  it("turns a checkbox option with a trailing blank (e.g. 其他：____) into an option plus a companion text field", () => {
    const md = ["☐ 我試過了", "☐ 其他：＿＿＿＿＿＿＿＿"].join("\n");
    const fields = getAssignmentFields(md, "t");
    expect(fields).toHaveLength(2);
    expect(fields[0].type).toBe("checkboxes");
    expect(fields[0].options?.map((o) => o.label)).toEqual(["我試過了", "其他"]);
    expect(fields[1].type).toBe("text");
    expect(fields[1].prompt).toContain("其他");
  });

  it("reads a table row of bare checkboxes under named columns as a single-select field", () => {
    const md = [
      "| # | 題目 | 是 | 否 |",
      "|---|---|---|---|",
      "| 1 | 我說不出上個月的客人分別從哪來 | ☐ | ☐ |",
    ].join("\n");
    const fields = getAssignmentFields(md, "t");
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe("checkboxes");
    expect(fields[0].multiple).toBe(false);
    expect(fields[0].options?.map((o) => o.label)).toEqual(["是", "否"]);
  });

  it("reads multiple checkbox options packed into a single table cell", () => {
    const md = [
      "| # | 檢查什麼 | 你手上有嗎 |",
      "|---|---|---|",
      "| 1 | 10 句原話 | ☐ 有　☐ 不到 10 句　☐ 有，但我改寫過 |",
    ].join("\n");
    const fields = getAssignmentFields(md, "t");
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe("checkboxes");
    expect(fields[0].options?.map((o) => o.label)).toEqual(["有", "不到 10 句", "有，但我改寫過"]);
  });

  it("still creates one field for a plain single blank (baseline behaviour)", () => {
    const md = "你的答案：\n\n＿＿＿＿＿＿＿＿＿＿＿＿";
    const fields = getAssignmentFields(md, "t");
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe("text");
  });
});

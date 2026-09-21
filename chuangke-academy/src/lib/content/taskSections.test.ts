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

  it("numbers a stack of bare '1. ____' / '2. ____' lines against the question above them, instead of using the digit itself as the label", () => {
    const md = ["**我要問的三題是：**", "", "1. ＿＿＿＿＿＿＿＿", "2. ＿＿＿＿＿＿＿＿", "3. ＿＿＿＿＿＿＿＿"].join("\n");
    const fields = getAssignmentFields(md, "t");
    expect(fields.map((f) => f.prompt)).toEqual(["我要問的三題是（第 1 題）", "我要問的三題是（第 2 題）", "我要問的三題是（第 3 題）"]);
  });

  it("still creates one field for a plain single blank (baseline behaviour)", () => {
    const md = "你的答案：\n\n＿＿＿＿＿＿＿＿＿＿＿＿";
    const fields = getAssignmentFields(md, "t");
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe("text");
  });

  it("looks past a bare '你的答案：' label to find the real question above it", () => {
    const md = [
      "### 步驟 3：寫出被服務的身分（一個名詞就好）",
      "",
      "**參考：** 上班族、國中生家長、新手媽媽",
      "",
      "**你的答案：**",
      "",
      "＿＿＿＿＿＿＿＿＿＿＿＿",
    ].join("\n");
    const fields = getAssignmentFields(md, "t");
    expect(fields).toHaveLength(1);
    expect(fields[0].prompt).not.toBe("你的答案");
    expect(fields[0].prompt).toContain("參考");
  });

  it("prefers a 句型 (template) line over a nearer but less useful line when both are in range", () => {
    const md = [
      "**句型：** 我只做【1.4-B 的相反】的【你這一行在做的事】。",
      "",
      "**你的答案：**",
      "",
      "我只做【＿＿＿＿＿＿＿＿＿＿】的【＿＿＿＿＿＿＿＿】。",
      "",
      "> **這條為什麼走得通：** 說明文字。",
      "",
      "☐ 我走的是篩選型，這一格先標暫定",
    ].join("\n");
    const fields = getAssignmentFields(md, "t");
    const checkboxField = fields.find((f) => f.type === "checkboxes");
    expect(checkboxField?.prompt).toContain("句型");
  });

  it("does not treat a '---' divider between sub-parts of the same block as a hard boundary", () => {
    const md = [
      "**背景說明文字，這是選 C 的理由。**",
      "",
      "---",
      "",
      "☐ **A 選項**：說明一",
      "☐ **B 選項**：說明二",
    ].join("\n");
    const fields = getAssignmentFields(md, "t");
    expect(fields).toHaveLength(1);
    expect(fields[0].prompt).not.toBe("請完成這一題");
  });

  it("binds A/B/C sentence blanks to the selected branch option", () => {
    const md = [
      "**你最強的信任來源是？**",
      "☐ A. 經歷型",
      "☐ B. 方法型",
      "☐ C. 結果型",
      "",
      "#### 如果你選 A（經歷型）",
      "我以前也【＿＿＿＿】，後來我【＿＿＿＿】。",
      "",
      "#### 如果你選 B（方法型）",
      "我有一套【＿＿＿＿】，專門解決【＿＿＿＿】。",
      "",
      "#### 如果你選 C（結果型）",
      "我做過【＿＿＿＿】，達成【＿＿＿＿】。",
    ].join("\n");
    const fields = getAssignmentFields(md, "stage-01-task-1");
    const branchFields = fields.filter((field) => field.dependsOn);
    expect(branchFields).toHaveLength(6);
    expect(new Set(branchFields.map((field) => field.dependsOn?.optionLabel))).toEqual(new Set(["經歷型", "方法型", "結果型"]));
  });

  it("keeps separate section tables as separate answer groups", () => {
    const md = [
      "## 任務 2-A：找原話",
      "| # | 原話 |",
      "|---|---|",
      "| 1 | ＿＿＿＿ |",
      "",
      "## 任務 2-B：找競爭者",
      "| # | 競爭者 |",
      "|---|---|",
      "| 1 | ＿＿＿＿ |",
    ].join("\n");
    const fields = getAssignmentFields(md, "stage-01-task-2");
    const groups = new Set(fields.map((field) => field.group));
    expect(groups.size).toBe(2);
    expect([...groups].some((group) => group?.includes("找原話"))).toBe(true);
    expect([...groups].some((group) => group?.includes("找競爭者"))).toBe(true);
  });
});

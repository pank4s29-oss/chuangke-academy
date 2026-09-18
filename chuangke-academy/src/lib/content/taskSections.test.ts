import { describe, expect, it } from "vitest";
import { getAssignmentFields } from "./taskSections";

describe("assignment question parser", () => {
  it("parses structured GFM single choice and stable blank ids", () => {
    const fields = getAssignmentFields("<!-- q:single id=audience -->\n- [ ] A. 第一個\n- [ ] B. 第二個\n\n我的答案：{{blank:audience-note}}", "task");
    expect(fields[0]).toMatchObject({ key: "task-audience", multiple: false, source: "structured" });
    expect(fields[0].options).toHaveLength(2);
    expect(fields[1]).toMatchObject({ key: "task-audience-note", source: "legacy" });
  });

  it("parses legacy checkbox symbols and blank table cells", () => {
    const fields = getAssignmentFields("只能勾一個\n☐ A. 選項一\n☐ B. 選項二\n\n| # | 原話 | 來源 |\n|---|---|---|\n| 1 |  |  |", "task");
    expect(fields[0].multiple).toBe(false);
    expect(fields.filter((field) => field.source === "table")).toHaveLength(2);
  });
});

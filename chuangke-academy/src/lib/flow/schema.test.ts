import { describe, expect, it } from "vitest";
import { parseFlowDocument } from "./schema";

describe("flow schema v1 blocks", () => {
  it("accepts matrix, schedule, checklist and date blocks", () => {
    const document = parseFlowDocument({
      schemaVersion: 1,
      stage: "stage-01",
      title: "測試",
      flows: { self_study: { label: "自學", parts: [{ id: "p", label: "測試", pageIds: ["p"] }], pages: [{ id: "p", part: "p", title: "測試", blocks: [{ type: "matrix", key: "stage1.t2.matrix", rows: [{ id: "r", label: "列" }], columns: [{ id: "c", label: "欄" }] }, { type: "date", key: "stage1.t5.date", label: "日期" }, { type: "schedule", rows: [{ id: "week", label: "週次" }], columns: [{ id: "task", label: "任務" }] }, { type: "checklist", key: "stage1.t5.check", options: [{ id: "a", label: "完成" }], multiple: true }] }], }, consult_session: { label: "諮詢", parts: [], pages: [] } },
      questions: {}, derived: {}, blueprint: { sections: [] }, legacyKeyMap: {}, dropped: [],
    });
    expect(document.flows.self_study.pages[0].blocks).toHaveLength(4);
  });
});

import { describe, expect, it } from "vitest";
import { flowMeta, mergeSubmissionAnswers, parseStoredState, scopedAnswers, taskKeyForPage } from "./persistence";
import type { FlowDocument } from "./schema";

const document = { legacyKeyMap: { old: "stage1.t1.a.identity" } } as unknown as FlowDocument;

describe("flow persistence", () => {
  it("maps page to task", () => { expect(taskKeyForPage("p.t1.a")).toBe("stage-01-1"); expect(taskKeyForPage("p.t3")).toBe("stage-01-3"); });
  it("loads semantic answers from legacy keys without deleting old data", () => expect(mergeSubmissionAnswers(document, [{ stage_key: "stage-01", task_key: "stage-01-1", answer_json: { old: "上班族" } }])).toMatchObject({ old: "上班族", "stage1.t1.a.identity": "上班族" }));
  it("scopes raw answers to the current task", () => expect(scopedAnswers(document, { "stage1.t1.a.identity": "上班族", "stage1.t3.flow": "目前沒有" }, "p.t1.a").answers).toEqual({ "stage1.t1.a.identity": "上班族" }));
  it("rejects malformed local state", () => expect(parseStoredState("not json")).toBeNull());
  it("keeps flow meta outside answer fields", () => expect(flowMeta(2, "self_study")).toEqual({ _flow: { page: 2, mode: "self_study", edited: [] } }));
});

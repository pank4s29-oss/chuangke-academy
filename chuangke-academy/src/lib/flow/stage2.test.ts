import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEngine } from "./derive";
import { loadFlowSpec } from "./parse";
import type { FlowState } from "./types";
import { validateFlow } from "./validate";

const dir = path.join(process.cwd(), "content/source/stage-02");
const assignment = fs.readFileSync(path.join(dir, "06_創客學院_階段二_作業_(正式版).md"), "utf8");
const lecture = fs.readFileSync(path.join(dir, "07_創客學院_階段二_講義_(正式版).md"), "utf8");
const spec = loadFlowSpec(fs.readFileSync(path.join(dir, "flow.yaml"), "utf8"), lecture);

describe("stage-02 guided flow", () => {
  it("parses the generated sidecar and validates references", () => {
    const report = validateFlow(spec, { 作業: assignment, 講義: lecture });
    expect(report.errors).toEqual([]);
    expect(Object.keys(spec.questions).length).toBe(155);
    expect(Object.keys(spec.pages).length).toBeGreaterThan(30);
  });

  it("keeps every imported answer field mapped to a legacy key", () => {
    const legacy = Object.values(spec.questions).flatMap((q) => q.legacyKeys);
    expect(legacy).toHaveLength(155);
    expect(new Set(legacy).size).toBe(155);
    expect(legacy).toContain("stage-02-2-1-answer-0");
    expect(legacy).toContain("stage-02-2-5-answer-35");
    expect(legacy).toContain("stage-02-附錄-answer-7");
  });

  it("generates the positioning sentence and weighted scores from learner answers", () => {
    const state: FlowState = { edited: [], answers: {
      "stage2.t23.q10": "先讓客人敢動手",
      "stage2.t23.q11": "o0", "stage2.t23.q12": "o0", "stage2.t23.q13": "剛開始接案的紋繡師",
      "stage2.t23.q15": "我有一套從第一步到第一次成交的流程",
      "stage2.t23.q17": "o0", "stage2.t23.q19": "o0", "stage2.t23.q22": "o0", "stage2.t23.q25": "先敢動手再學技術",
      "stage2.t24.q0": "o2", "stage2.t24.q2": ["o0", "o1"], "stage2.t24.q4": "o1", "stage2.t24.q6": ["o0", "o2"],
      "stage2.t25.q0": ["o0", "o2"], "stage2.t25.q2": ["o0", "o1", "o3"], "stage2.t25.q4": "o1",
    } };
    const engine = createEngine(spec, state);
    expect(engine.value("stage2.t23.q14")).toContain("對【剛開始接案的紋繡師】而言");
    expect(engine.value("stage2.t23.q14")).toContain("先讓客人敢動手");
    expect(engine.values["stage2.t23.short_check"]?.tone).toBe("good");
    expect(engine.values["stage2.t23.tests_check"]?.tone).toBe("good");
    expect(engine.values["stage2.t24.leverage1.score"]?.number).toBe(3);
    expect(engine.values["stage2.t24.leverage2.score"]?.number).toBe(2);
    expect(engine.values["stage2.t24.leverage3.score"]?.number).toBe(3);
    expect(engine.values["stage2.t24.leverage4.score"]?.number).toBe(2);
    expect(engine.values["stage2.t25.concern1.score"]?.number).toBe(2);
    expect(engine.values["stage2.t25.concern2.score"]?.number).toBe(3);
    expect(engine.values["stage2.t25.concern3.score"]?.number).toBe(2);
  });
});

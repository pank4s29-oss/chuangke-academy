import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEngine } from "./derive";
import { getQuestionGuidance } from "./guidance";
import { loadFlowSpec } from "./parse";
import type { FlowState } from "./types";

const dir = path.join(process.cwd(), "content/source/stage-01");
const lecture = fs.readFileSync(path.join(dir, "01_創客學院_階段一_講義(正式版).md"), "utf8");
const spec = loadFlowSpec(fs.readFileSync(path.join(dir, "flow.yaml"), "utf8"), lecture);

const engine = (answers: FlowState["answers"] = {}) => createEngine(spec, { answers, edited: [] });

describe("guided question coach", () => {
  it("explains why an upstream answer matters and names the composed output", () => {
    const guidance = getQuestionGuidance(spec, "stage1.t1.a.identity", engine());
    expect(guidance.meaning).toContain("清楚的身分");
    expect(guidance.why).toContain("第一句定位句");
    expect(guidance.downstream).toContain("把上面兩格套進句子");
    expect(guidance.hasImpact).toBe(true);
  });

  it("reports that an incomplete composed sentence still has blanks", () => {
    const guidance = getQuestionGuidance(spec, "stage1.t1.a.state", engine({ "stage1.t1.a.identity": "紋繡師" }));
    expect(guidance.downstream.length).toBeGreaterThan(0);
    expect(guidance.missing.length).toBeGreaterThan(0);
  });

  it("uses generic guidance for stage two generated questions", () => {
    const stage2Dir = path.join(process.cwd(), "content/source/stage-02");
    const stage2 = loadFlowSpec(fs.readFileSync(path.join(stage2Dir, "flow.yaml"), "utf8"), fs.readFileSync(path.join(stage2Dir, "07_創客學院_階段二_講義_(正式版).md"), "utf8"));
    const q = Object.keys(stage2.questions)[0];
    const guidance = getQuestionGuidance(stage2, q, createEngine(stage2, { answers: {}, edited: [] }));
    expect(guidance.meaning.length).toBeGreaterThan(5);
    expect(guidance.why.length).toBeGreaterThan(5);
  });
});

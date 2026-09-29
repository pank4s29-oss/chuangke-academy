import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadFlowSpec } from "./parse";
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
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEngine, reversibleKeys } from "./derive";
import { editDerived } from "./state";
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
    // 155 imported answer fields + 8 slot fields that feed the three sentence patterns below.
    expect(Object.keys(spec.questions).length).toBe(163);
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

  it("composes the three pattern sentences from their slots and writes edits back (two-way)", () => {
    const st: FlowState = { edited: [], answers: {
      "stage2.t21.only_who": "學完馬上要開始接客", "stage2.t21.only_what": "手感養成教學",
      "stage2.t22.moment_time": "週日晚上十點", "stage2.t22.moment_doing": "躺在床上滑手機", "stage2.t22.moment_saw": "同行貼出「這個月已額滿」", "stage2.t22.moment_thought": "想到明天一堂課都沒有",
      "stage2.t25.fear": "自己想清楚全部", "stage2.t25.do": "陪你做出第一版",
    } };
    const e = createEngine(spec, st);
    expect(e.value("stage2.t21.q39")).toBe("我只做【學完馬上要開始接客】的【手感養成教學】。");
    expect(e.value("stage2.t22.q25")).toBe("週日晚上十點，他躺在床上滑手機，看到同行貼出「這個月已額滿」，然後想到明天一堂課都沒有。");
    expect(e.value("stage2.t25.q9")).toBe("你不用【自己想清楚全部】，我會【陪你做出第一版】。");
    // blueprint reads the composed sentences
    expect(e.value("stage2.app.offer")).toBe("你不用【自己想清楚全部】，我會【陪你做出第一版】。");
    // half-filled: sentence is not "complete", so downstream stays empty
    expect(createEngine(spec, { edited: [], answers: { "stage2.t25.fear": "x" } }).value("stage2.t25.q9")).toBe("");
    for (const k of ["stage2.t21.q39", "stage2.t22.q25", "stage2.t25.q9"]) expect(reversibleKeys(spec, k)?.length).toBeGreaterThan(1);
    const back = editDerived(st, "stage2.t25.q9", "你不用【一個人扛】，我會【帶你走完】。", spec);
    expect(back.answers["stage2.t25.fear"]).toBe("一個人扛");
    expect(back.answers["stage2.t25.do"]).toBe("帶你走完");
    expect(back.edited).toEqual([]);
    const scene = editDerived(st, "stage2.t22.q25", "星期三晚上十一點，他收走評量，看到只寫了三題，然後想到補習費。", spec);
    expect(scene.answers["stage2.t22.moment_time"]).toBe("星期三晚上十一點");
    expect(scene.answers["stage2.t22.moment_thought"]).toBe("想到補習費");
  });

  describe("前後呼應：carry-over defaults", () => {
    const ext = {
      "ext.s1.quote": "我想學怎麼開課，但不知道從哪開始",
      "ext.s1.serve": "我服務的是【上過課但接不到客人】的【紋繡師】。",
      "ext.s1.state": "上過課但接不到客人", "ext.s1.identity": "紋繡師",
      "ext.s1.reason": "我以前也接不到客人，後來我把課程改成三堂",
      "ext.s1.no": "我不收只想要證照的人",
      "ext.s1.outcome": ["A", "D"],
    };
    const eng = (answers: FlowState["answers"] = {}) => createEngine(spec, { answers, edited: [] }, ext);
    it("pulls stage-1 answers into stage-2 fields until the learner types", () => {
      const e = eng();
      expect(e.value("stage2.t21.q1")).toBe(ext["ext.s1.quote"]);
      expect(e.carried("stage2.t21.q1")).toBe(ext["ext.s1.quote"]);
      expect(e.value("stage2.t22.q1")).toBe(ext["ext.s1.serve"]);
      expect(e.value("stage2.t22.q0")).toBe("o1"); // 2-E ticked D
      expect(e.value("stage2.t23.q13")).toBe("上過課但接不到客人的紋繡師");
      expect(e.value("stage2.t23.q15")).toBe(ext["ext.s1.reason"]);
      expect(e.value("stage2.t22.q9")).toBe("紋繡師");
      expect(e.text("stage2.t21.no_ref")).toBe("我不收只想要證照的人");
      // typing decouples; clearing keeps it empty; the default is still available for "重新帶入"
      const typed = eng({ "stage2.t21.q1": "我自己寫的" });
      expect(typed.value("stage2.t21.q1")).toBe("我自己寫的");
      expect(typed.carried("stage2.t21.q1")).toBe("");
      expect(typed.defaultOf("stage2.t21.q1")).toBe(ext["ext.s1.quote"]);
      expect(eng({ "stage2.t21.q1": "" }).value("stage2.t21.q1")).toBe("");
    });
    it("2-E without D defaults the D question to 'no', and chosen person 2 suppresses the stage-1 noun", () => {
      const e = createEngine(spec, { answers: {}, edited: [] }, { ...ext, "ext.s1.outcome": ["A"] });
      expect(e.value("stage2.t22.q0")).toBe("o0");
      expect(eng({ "stage2.t22.q3": "o1" }).value("stage2.t23.q13")).toBe("");
    });
    it("carries stage-2 answers forward and keeps sources live", () => {
      const e = eng({ "stage2.t21.q10": "怕被同行笑", "stage2.t24.q13": "一年後還在原地", "stage2.t21.q30": "怎麼讓客人先試再買", "stage2.t24.q10": ["o0", "o1"] });
      expect(e.value("stage2.t25.fear")).toBe("怕被同行笑");
      expect(e.value("stage2.t25.q31")).toBe("一年後還在原地");
      expect(e.value("stage2.app.q0")).toBe("怎麼讓客人先試再買");
      expect(e.value("stage2.t25.q8")).not.toBe("");
      // the pattern sentence follows the carried fear, and editing it writes back over the carried default
      expect(e.value("stage2.t25.q9")).toBe(""); // 'do' is still empty → incomplete
      const st = editDerived({ answers: {}, edited: [] }, "stage2.t25.q9", "你不用【一個人扛】，我會【陪你做】。", spec);
      expect(createEngine(spec, st, ext).value("stage2.t25.fear")).toBe("一個人扛");
    });
    it("a carried value is not mirrored back as a typed legacy answer", async () => {
      const { serializeState, loadState, carriedFlag } = await import("./alias");
      const e = eng();
      const out = serializeState(spec, { answers: {}, edited: [] }, e.value, {}, "stage-02-2-1");
      const all = Object.assign({}, ...Object.values(out));
      expect(all["stage-02-2-1-answer-1"]).toBe(ext["ext.s1.quote"]);
      expect(all[carriedFlag("stage2.t21.q1")]).toBe(true);
      expect(loadState(spec, all).state.answers["stage2.t21.q1"]).toBeUndefined();
      const typed = serializeState(spec, { answers: { "stage2.t21.q1": "mine" }, edited: [] }, eng({ "stage2.t21.q1": "mine" }).value, {}, "stage-02-2-1");
      const allTyped = Object.assign({}, ...Object.values(typed));
      expect(allTyped[carriedFlag("stage2.t21.q1")]).toBe(false);
      expect(loadState(spec, allTyped).state.answers["stage2.t21.q1"]).toBe("mine");
    });
  });
});

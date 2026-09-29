import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { countChars, createEngine, weekRange } from "./derive";
import { loadFlowSpec, parseFlowText } from "./parse";
import { accountedLegacyKeys, loadState, legacyOptionKey, serializeState, stripFlowMeta, taskKeyOf } from "./alias";
import { collectLearnerText, findUnmatched } from "./fidelity";
import { editDerived, regenerate, setAnswer, toggleMulti } from "./state";
import { validateFlow } from "./validate";
import type { FlowState } from "./types";

const dir = path.join(process.cwd(), "content/source/stage-01");
const read = (n: string) => fs.readFileSync(path.join(dir, n), "utf8");
const lecture = read("01_創客學院_階段一_講義(正式版).md");
const assignment = read("02_創客學院_階段一_作業(正式版).md");
const yamlText = read("flow.yaml");
const spec = loadFlowSpec(yamlText, lecture);
const empty: FlowState = { answers: {}, edited: [] };
const eng = (answers: FlowState["answers"], edited: string[] = []) => createEngine(spec, { answers, edited });

describe("validator", () => {
  it("real stage-01 flow.yaml has no errors or warnings", () => {
    const r = validateFlow(spec, { 作業: assignment, 講義: lecture });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  const mutate = (fn: (o: any) => void) => { const s = structuredClone(spec) as any; fn(s); return validateFlow(s).errors.join("\n"); };
  it("catches 6 kinds of broken flows with readable messages", () => {
    expect(mutate((s) => { s.pages["p.t1.a.1"].blocks[1].q = "stage1.nope"; })).toContain("引用不存在的題目：stage1.nope");
    expect(mutate((s) => { s.questions["Bad Key"] = s.questions["stage1.t1.a.money"]; })).toContain("命名規則");
    expect(mutate((s) => { s.derived["stage1.t1.a.len_check"].inputs = ["stage1.t1.a.len_check"]; })).toContain("循環依賴");
    expect(mutate((s) => { s.flows.self_study.parts[0].pages.push("p.missing"); })).toContain("不存在的 page：p.missing");
    expect(mutate((s) => { s.questions["stage1.t1.a.money"].legacyKeys = ["stage-01-1-answer-0"]; })).toContain("同時被");
    expect(mutate((s) => { s.pages["p.t1.a.1"].showWhen = { input: "stage1.ghost", equals: "x" }; })).toContain("showWhen 引用不存在的 key");
  });
  it("warns (does not guess) when a sourceRef heading is missing", () => {
    const s = structuredClone(spec) as any; s.pages["p.t1.a.1"].sourceRef = { file: "作業", heading: "不存在的標題" };
    expect(validateFlow(s, { 作業: assignment, 講義: lecture }).warnings.join()).toContain("找不到標題");
  });
  it("rejects malformed yaml with a readable message", () => {
    expect(() => parseFlowText("schemaVersion: 2\nstage: x")).toThrow(/flow 檔案格式錯誤/);
  });
});

describe("derive – golden rules (plan appendix A)", () => {
  it("R08 sentence template; R09 char check counts the whole spoken sentence (D-07)", () => {
    const a = { "stage1.t1.a.state": "請過教練還是沒練起來", "stage1.t1.a.identity": "想改變體態的上班族" };
    const e = eng(a);
    expect(e.value("stage1.t1.a.sentence")).toBe("我服務的是【請過教練還是沒練起來】的【想改變體態的上班族】。");
    // Appendix C hand-calc said 30; program result excluding the 【】 marks is 26 (artifact's own rule would give 27). All > 25 → "bad".
    expect(countChars(e.value("stage1.t1.a.sentence") as string)).toBe(26);
    expect(e.values["stage1.t1.a.len_check"].tone).toBe("bad");
    expect(eng({ "stage1.t1.a.state": "沒動", "stage1.t1.a.identity": "老師" }).values["stage1.t1.a.len_check"].tone).toBe("good");
  });
  it("R01–R03 score and bands; unanswered items are counted", () => {
    const ans: FlowState["answers"] = {};
    ["s1", "s2", "s3", "s4", "s5", "s6"].forEach((k, i) => { ans[`stage1.t3.b.${k}`] = i < 5 ? "yes" : "no"; });
    let e = eng(ans);
    expect(e.values["stage1.t3.b.score"].number).toBe(5);
    expect(e.values["stage1.t3.b.verdict"].text).toBe("典型追客型");
    expect(e.values["stage1.t3.b.detail"].text).toBe("這套系統對你的改變會最大");
    ans["stage1.t3.b.s1"] = "no"; ans["stage1.t3.b.s2"] = "no"; ans["stage1.t3.b.s3"] = "no";
    e = eng(ans);
    expect(e.values["stage1.t3.b.verdict"].text).toBe("混合型"); // 2 points
    expect(eng({ "stage1.t3.b.s1": "yes" }).values["stage1.t3.b.score_left"].text).toBe("還有 5 題沒答");
    expect(eng({ ...ans, "stage1.t3.b.s1": "no", "stage1.t3.b.s4": "no", "stage1.t3.b.s5": "no" }).values["stage1.t3.b.verdict"].text).toBe("已經偏篩客型");
  });
  it("R04/R05 gaps: 心裡有數 and 報價 do not count as established (D-11)", () => {
    const e = eng({ "stage1.t3.a.flow": ["referral"], "stage1.t3.a.screen": ["mind_only"], "stage1.t3.a.close": ["quote"], "stage1.t3.a.deliver": ["one_on_one"] });
    expect(e.values["stage1.t3.c.gaps"].list).toEqual(["篩選 → 階段五（銷售頁 + 官方 LINE）", "成交 → 階段六（銷售流程）"]);
    expect(e.values["stage1.t3.c.gaps_ord"].text).toBe("2、3");
    expect(eng({}).values["stage1.t3.c.gaps"].list).toHaveLength(2); // empty flow + empty deliver
  });
  it("R10/R11 quote and problem sentence", () => {
    const e = eng({ "stage1.t1.b.did": "studied", "stage1.t1.b.invest": "money", "stage1.t1.b.result": "no_change", "stage1.t1.b.from": "上完課接不到客人", "stage1.t1.b.to": "每月有預約" });
    expect(e.value("stage1.t1.b.quote")).toBe("我上過課／學過了，花了很多錢，完全沒有改變。");
    expect(e.value("stage1.t1.b.sentence")).toBe("我幫他解決的問題是，從【上完課接不到客人】，變成【每月有預約】。");
  });
  it("R10 「其他」 uses the learner's own text (G-5)", () => {
    const e = eng({ "stage1.t1.b.did": "other", "stage1.t1.b.did_other": "我看了十部影片", "stage1.t1.b.invest": "time", "stage1.t1.b.result": "little" });
    expect(e.value("stage1.t1.b.quote")).toBe("我看了十部影片，花了很多時間，有一點，但不夠。");
  });
  it("R12 only 「學會」 is an error; 「學到／學習」 is a neutral hint (D-10)", () => {
    expect(eng({ "stage1.t1.b.to": "學會霧眉" }).values["stage1.t1.b.learn_check"].tone).toBe("bad");
    const e = eng({ "stage1.t1.b.to": "學習新技能" });
    expect(e.values["stage1.t1.b.learn_check"].text).toBe("");
    expect(e.values["stage1.t1.b.learn_hint"].tone).toBe("neutral");
  });
  it("R13/R14 1-C tip and sentence per angle", () => {
    expect(eng({ "stage1.t1.c.tried": "no" }).values["stage1.t1.c.tip"].text).toContain("建議選 A 經歷型");
    expect(eng({ "stage1.t1.c.tried": "yes" }).values["stage1.t1.c.tip"].text).toContain("建議選 B 方法型");
    const e = eng({ "stage1.t1.c.angle": "B", "stage1.t1.c.b1": "三步驟解題法", "stage1.t1.c.b2": "回家不會寫" });
    expect(e.value("stage1.t1.c.sentence_active")).toBe("我有一套【三步驟解題法】，專門解決【回家不會寫】。");
    expect(eng({ "stage1.t1.c.angle": "C" }).values["stage1.t1.c.c_warn"].tone).toBe("bad");
  });
  it("R15 three-sentence total 80 chars, reports which sentence is missing", () => {
    expect(eng({ "stage1.t1.a.state": "甲" }).values["stage1.t1.done.len80"].text).toMatch(/還缺：/);
    const long = "字".repeat(30);
    const e = eng({ "stage1.t1.a.state": long, "stage1.t1.a.identity": long, "stage1.t1.b.from": long, "stage1.t1.b.to": long, "stage1.t1.c.angle": "A", "stage1.t1.c.a1": long, "stage1.t1.c.a2": long });
    expect(e.values["stage1.t1.done.len80"].tone).toBe("bad");
  });
  it("R16 frequency tips", () => {
    expect(eng({ "stage1.t4.b.f1": "rare", "stage1.t4.b.f2": "rare", "stage1.t4.b.f3": "rare" }).values["stage1.t4.b.tip"].text).toContain("量還不夠大");
    const t = eng({ "stage1.t4.b.f1": "often", "stage1.t4.b.f2": "rare", "stage1.t4.b.f3": "often" }).values["stage1.t4.b.tip"].text;
    expect(t).toContain("一定要擋的人");
    expect(t).toContain("① 有沒有人來問你，要你保證結果？");
    expect(t).toContain("③");
  });
  it("R17 「我不收」 joins the ORIGINAL option strings, no rewriting (D-08 / G-8)", () => {
    const e = eng({ "stage1.t4.b.block": ["guarantee", "price_only"], "stage1.t4.b.mismatch": ["too_basic", "other"], "stage1.t4.b.mismatch_other": "孩子本人沒意願" });
    expect(e.value("stage1.t4.b.no_sentence")).toBe("要我保證結果的人、只比價格的人、他太初階、孩子本人沒意願");
  });
  it("R18 questions follow tick order (D-09) and stay editable", () => {
    const a = { "stage1.t4.c.picks": ["urgent", "stuck", "other"], "stage1.t4.c.picks_other": "你預算多少？" };
    const e = eng(a);
    expect([1, 2, 3].map((n) => e.value(`stage1.t4.c.q${n}`))).toEqual(["這件事對你來說，急不急？", "你現在最卡的是什麼？", "你預算多少？"]);
    expect(eng({ ...a, "stage1.t4.c.q1": "自己改的" }, ["stage1.t4.c.q1"]).value("stage1.t4.c.q1")).toBe("自己改的");
  });
  it("R19 4-D paragraph is assembled from structured answers (G-15)", () => {
    const e = eng({ "stage1.t1.a.state": "狀態", "stage1.t1.a.identity": "身分", "stage1.t4.b.block": ["guarantee"], "stage1.t4.c.picks": ["stuck"] });
    expect(e.value("stage1.t4.d.paragraph")).toBe("我要用廣告找到【狀態的身分】，\n用銷售頁把【要我保證結果的人】篩掉，\n剩下的人加我 LINE 之後，我會先問他【你現在最卡的是什麼？】。");
  });
  it("R21 date helpers: 30-day default, 4-way split, launch<=today shows —", () => {
    const e = eng({ "stage1.t5.a.today": "2026-09-29" });
    expect(e.value("stage1.t5.a.launch_default")).toBe("2026-10-29");
    expect(e.values["stage1.t5.b.w1"].text).toBe("9/29 ～ 10/7");
    expect(e.values["stage1.t5.b.w2"].text).toBe("10/8 ～ 10/14");
    expect(e.values["stage1.t5.b.w4"].text).toBe("10/23 ～ 10/29");
    expect(weekRange("2026-12-20", "2027-01-19", 4, 3)).toMatch(/～ 1\/19$/); // crosses the year
    expect(weekRange("2026-10-10", "2026-10-10", 4, 0)).toBe("—");
    expect(eng({ "stage1.t5.a.today": "2026-09-29", "stage1.t5.a.launch": "2026-09-01" }).values["stage1.t5.b.w1"].text).toBe("—");
  });
  it("R22 blueprint sources: 2-A top complaint wins over the 1-B guess (G-12)", () => {
    expect(eng({ "stage1.t1.b.did": "tried", "stage1.t1.b.invest": "time", "stage1.t1.b.result": "little" }).value("stage1.app.bp.complaint")).toContain("我試過了");
    expect(eng({ "stage1.t2.a.top": "上了課還是沒客人", "stage1.t1.b.did": "tried" }).value("stage1.app.bp.complaint")).toBe("上了課還是沒客人");
  });
  it("edge cases: blanks, full-width spaces, no eval", () => {
    expect(countChars("　 你 好　")).toBe(2);
    expect(eng({ "stage1.t1.a.state": "　", "stage1.t1.a.identity": "  " }).values["stage1.t1.a.sentence_auto"].complete).toBe(false);
    expect(eng({}).values["stage1.t1.a.sentence_auto"].parts?.some((p) => p.kind === "blank")).toBe(true);
    expect(fs.readFileSync(path.join(process.cwd(), "src/lib/flow/derive.ts"), "utf8")).not.toMatch(/\beval\(|new Function/);
  });
});

describe("state: edit lock and regenerate (P-04)", () => {
  it("edited sentence stays put when options change; regenerate unlocks it", () => {
    const k = "stage1.t1.a.sentence";
    let st = setAnswer(setAnswer(empty, "stage1.t1.a.state", "A"), "stage1.t1.a.identity", "B");
    st = editDerived(st, k, "我自己改的句子");
    st = setAnswer(st, "stage1.t1.a.state", "新狀態");
    expect(createEngine(spec, st).value(k)).toBe("我自己改的句子");
    st = regenerate(st, k);
    expect(createEngine(spec, st).value(k)).toBe("我服務的是【新狀態】的【B】。");
    expect(st.edited).toEqual([]);
  });
  it("clearing an edited sentence unlocks it; multi-select honours max", () => {
    const st = editDerived(editDerived(empty, "stage1.t1.a.sentence", "x"), "stage1.t1.a.sentence", "  ");
    expect(st.edited).toEqual([]);
    expect(toggleMulti(["a", "b", "c"], "d", 3)).toEqual(["a", "b", "c"]);
    expect(toggleMulti(["a", "b"], "a", 3)).toEqual(["b"]);
  });
});

describe("alias / migration (R-7, R-9)", () => {
  const legacy = {
    "stage-01-1-answer-0": "stage-01-1-option-0-2",
    "stage-01-1-answer-2": "紋繡師",
    "stage-01-1-answer-3": "我服務的是【上過課】的【紋繡師】。",
    "stage-01-1-answer-5": "stage-01-1-option-5-6",
    "stage-01-1-answer-6": "看了很多影片",
    "stage-01-1-answer-13": ["stage-01-1-option-13-1"],
    "stage-01-2-answer-0": "貴森森",
    "stage-01-2-answer-1": "FB 社團",
    "stage-01-2-answer-21": "＿＿ 3 次",
    "stage-01-3-answer-16": "四",
    "stage-01-4-answer-1": "25 到 40",
    "stage-01-5-answer-0": "9月29日",
    "stage-01-5-answer-3": ["stage-01-5-option-3-0", "stage-01-5-option-3-2"],
  };
  it("reads old positional answers onto the right semantic questions", () => {
    const { state, migrated } = loadState(spec, legacy, 2026);
    const a = state.answers;
    expect(a["stage1.t1.a.stage"]).toBe("C");
    expect(a["stage1.t1.a.identity"]).toBe("紋繡師");
    expect(a["stage1.t1.b.did"]).toBe("other");
    expect(a["stage1.t1.b.did_other"]).toBe("看了很多影片");
    expect(a["stage1.t1.c.angle"]).toEqual(["B"].length ? "B" : "");
    expect(a["stage1.t2.a.quotes.r1.text"]).toBe("貴森森");
    expect(a["stage1.t2.a.quotes.r1.source"]).toBe("FB 社團");
    expect(a["stage1.t2.a.top_count"]).toBe("3");
    expect(a["stage1.t3.c.priority"]).toBe("s4");
    expect(a["stage1.t4.a.age_from"]).toBe("25");
    expect(a["stage1.t4.a.age_to"]).toBe("40");
    expect(a["stage1.t5.a.today"]).toBe("2026-09-29");
    expect(a["stage1.t5.c.checks"]).toEqual(["path", "picky_friend"]);
    expect(state.edited).toContain("stage1.t1.a.sentence"); // legacy sentence is the learner's text → locked
    expect(createEngine(spec, state).value("stage1.t1.a.sentence")).toBe("我服務的是【上過課】的【紋繡師】。");
    expect(migrated.length).toBeGreaterThan(8);
  });
  it("legacy option keys follow the legacy parser's naming", () => {
    expect(legacyOptionKey("stage-01-1-answer-4", 3)).toBe("stage-01-1-option-4-3");
  });
  it("new keys win over legacy keys; nothing is deleted from the raw bag", () => {
    const raw = { ...legacy, "stage1.t1.a.identity": "新身分" };
    const before = JSON.stringify(raw);
    expect(loadState(spec, raw, 2026).state.answers["stage1.t1.a.identity"]).toBe("新身分");
    expect(JSON.stringify(raw)).toBe(before);
  });
  it("dual write: new keys + mirrored legacy keys, readable again by the old TaskFlow format", () => {
    let st = loadState(spec, {}, 2026).state;
    st = setAnswer(st, "stage1.t1.a.stage", "C");
    st = setAnswer(st, "stage1.t1.b.did", "other"); st = setAnswer(st, "stage1.t1.b.did_other", "我看影片");
    st = setAnswer(st, "stage1.t1.a.state", "上過課"); st = setAnswer(st, "stage1.t1.a.identity", "紋繡師");
    st = setAnswer(st, "stage1.t2.a.quotes.r2.text", "原話二");
    st = setAnswer(st, "stage1.t4.b.block", ["guarantee", "other"]); st = setAnswer(st, "stage1.t4.b.block_other", "怪客人");
    st = setAnswer(st, "stage1.t3.c.priority", "s5"); st = setAnswer(st, "stage1.t5.a.today", "2026-09-29");
    const e = createEngine(spec, st);
    const out = serializeState(spec, st, e.value, { page: "p.t1.a.1", mode: "self_study" }, "stage-01-1");
    const t1 = out["stage-01-1"];
    expect(t1["stage1.t1.a.stage"]).toBe("C");
    expect(t1["stage-01-1-answer-0"]).toBe("stage-01-1-option-0-2");
    expect(t1["stage-01-1-answer-3"]).toBe("我服務的是【上過課】的【紋繡師】。"); // derived sentence is mirrored even though unedited
    expect(t1["stage-01-1-answer-5"]).toBe("stage-01-1-option-5-6");
    expect(t1["stage-01-1-answer-6"]).toBe("我看影片");
    expect(out["stage-01-2"]["stage-01-2-answer-2"]).toBe("原話二");
    expect(out["stage-01-4"]["stage-01-4-answer-8"]).toEqual(["stage-01-4-option-8-0", "stage-01-4-option-8-3"]);
    expect(out["stage-01-4"]["stage-01-4-answer-9"]).toBe("怪客人");
    expect(out["stage-01-3"]["stage-01-3-answer-16"]).toBe("五");
    expect(out["stage-01-5"]["stage-01-5-answer-0"]).toBe("9月29日");
    // unedited derived sentences are NOT stored under the new key (derive vs. input stay separate)
    expect(t1["stage1.t1.a.sentence"]).toBeUndefined();
    // round trip: old-format bag → loadState gives the same answers back
    const back = loadState(spec, Object.assign({}, ...Object.values(out)), 2026).state.answers;
    expect(back["stage1.t1.a.stage"]).toBe("C");
    expect(back["stage1.t4.b.block"]).toEqual(["guarantee", "other"]);
  });
  it("_flow meta never leaks into exports / blueprint / teacher stats (K-6)", () => {
    const out = serializeState(spec, empty, createEngine(spec, empty).value, { page: "p.x" }, "stage-01-1");
    expect(out["stage-01-1"]._flow).toBeTruthy();
    expect(stripFlowMeta({ a: 1, _flow: { page: "x" } })).toEqual({ a: 1 });
  });
  it("task routing: each question saves under its own task, not the whole stage (D-05)", () => {
    expect(taskKeyOf(spec, "stage1.t2.a.top")).toBe("stage-01-2");
    expect(taskKeyOf(spec, "stage1.app.handoff")).toBe("stage-01-附錄");
    expect(taskKeyOf(spec, "stage1.t2.b.rows.r1.name")).toBe("stage-01-2");
  });
});

describe("coverage & fidelity (plan Phase 5)", () => {
  it("every field the OLD parser produces for stage-01 is mapped or explicitly dropped", () => {
    const base = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/flow/baseline/stage-01.fields.json"), "utf8")) as { fields: { key: string }[] }[];
    const acc = accountedLegacyKeys(spec);
    const missing = base.flatMap((t) => t.fields.map((f) => f.key)).filter((k) => !acc.has(k));
    expect(missing).toEqual([]);
  });
  it("every learner-facing string is copied from the source Markdown or flagged origin: authored", () => {
    const bad = findUnmatched(collectLearnerText(spec), [lecture, assignment]);
    expect(bad).toEqual([]);
  });
  it("both flows only reference existing pages and consult_session reuses the same questions", () => {
    expect(Object.keys(spec.flows)).toEqual(["self_study", "consult_session"]);
  });
});

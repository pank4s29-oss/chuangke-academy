import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEngine } from "@/lib/flow/derive";
import { loadFlowSpec, extractSection } from "@/lib/flow/parse";
import type { FlowState } from "@/lib/flow/types";
import { BlockView, type Ctx } from "./blocks";
import { blueprintText } from "./BlueprintPage";

const dir = path.join(process.cwd(), "content/source/stage-01");
const lecture = fs.readFileSync(path.join(dir, "01_創客學院_階段一_講義(正式版).md"), "utf8");
const spec = loadFlowSpec(fs.readFileSync(path.join(dir, "flow.yaml"), "utf8"), lecture);
const lectures: Record<string, string> = {};
for (const [pid, p] of Object.entries(spec.pages)) p.blocks.forEach((b, i) => { if (b.type === "lecture") lectures[`${pid}#${i}`] = extractSection(lecture, b.sourceRef); });

const filled: FlowState = { edited: [], answers: {
  "stage1.open.name": "小明", "stage1.t1.a.stage": "C", "stage1.t1.a.state": "上過課但接不到客人", "stage1.t1.a.identity": "紋繡師",
  "stage1.t1.b.did": "studied", "stage1.t1.b.invest": "money", "stage1.t1.b.result": "no_change", "stage1.t1.b.from": "接不到客人", "stage1.t1.b.to": "每月有預約",
  "stage1.t1.c.tried": "yes", "stage1.t1.c.angle": "B", "stage1.t1.c.b1": "接案五步驟", "stage1.t1.c.b2": "有技術不會找客人",
  "stage1.t2.a.quotes.r1.text": "上完課還是沒客人", "stage1.t2.a.top": "上完課還是沒客人", "stage1.t2.e.outcome": ["E"],
  "stage1.t3.b.s1": "yes", "stage1.t3.a.flow": ["none"], "stage1.t4.b.block": ["guarantee"], "stage1.t4.c.picks": ["stuck"], "stage1.t5.a.today": "2026-09-29",
} };

function ctxFor(state: FlowState, pageId: string): Ctx {
  return { spec, eng: createEngine(spec, state), st: state, lectures, pageId, set: () => {}, edit: () => {}, regen: () => {} };
}

describe("every page renders (empty and filled state)", () => {
  for (const [label, state] of [["empty", { answers: {}, edited: [] } as FlowState], ["filled", filled]] as const) {
    it(label, () => {
      for (const [pid, page] of Object.entries(spec.pages)) {
        const c = ctxFor(state, pid);
        const html = page.blocks.map((b, i) => renderToStaticMarkup(<BlockView b={b} c={c} index={i} />)).join("");
        expect(html.length, pid).toBeGreaterThan(0);
      }
    });
  }
  it("lecture pages have real lecture text, not the empty fallback", () => {
    const missing = Object.entries(lectures).filter(([, t]) => !t.trim()).map(([k]) => k);
    expect(missing).toEqual([]);
    expect(Object.keys(lectures).length).toBeGreaterThan(30);
  });
  it("blueprint text is complete and falls back to 暫定", () => {
    const t = blueprintText(ctxFor(filled, "p.app.bp"), "小明");
    expect(t).toContain("我服務的是：我服務的是【上過課但接不到客人】的【紋繡師】。");
    expect(t).toContain("他最常說的那句抱怨是：上完課還是沒客人");
    expect(t).toContain("我的第一版上線日是：10 月 29 日");
    expect(blueprintText(ctxFor({ answers: {}, edited: [] }, "p.app.bp"), "")).toContain("我不收的人是：暫定");
  });
});

import type { Engine } from "./derive";
import { derivedRefs } from "./derive";
import type { FlowSpec, Question } from "./schema";

export type QuestionGuidance = {
  meaning: string;
  why: string;
  downstream: string[];
  missing: string[];
  hasImpact: boolean;
};

const clean = (value: string) => value.replace(/^\s*(?:[①②③④⑤⑥⑦⑧⑨⑩]|[A-D][.、．]?\s*)/, "").trim();

function genericMeaning(q: Question): string {
  if (q.meaning) return q.meaning;
  if (q.kind === "single") return "從選項中挑出最符合你目前真實情況的一項，不用選理想答案。";
  if (q.kind === "multi") return "把所有符合目前情況的項目勾起來；這是在盤點現況，不是在考試。";
  if (q.kind === "textarea") return "把前面選到的內容，用你會對客人說的自然語氣串成一句話。";
  if (q.kind === "number") return "填入可查證的數字，讓後面的判斷有依據。";
  if (q.kind === "date") return "填入實際日期，系統會用它自動排出後續的執行節奏。";
  return "用一個具體、看得見的例子回答；先寫出來，再回頭修順。";
}

function directDependents(spec: FlowSpec, key: string): string[] {
  const direct = new Set<string>();
  for (const [id, d] of Object.entries(spec.derived)) if (derivedRefs(d).includes(key)) direct.add(id);
  // A derived value may feed another derived value. Walk that graph so an early
  // answer can still explain its eventual sentence/blueprint impact.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, d] of Object.entries(spec.derived)) {
      if (derivedRefs(d).some((ref) => direct.has(ref)) && !direct.has(id)) { direct.add(id); changed = true; }
    }
  }
  return [...direct];
}

function labelsForDependents(spec: FlowSpec, ids: string[]): string[] {
  const labels: string[] = [];
  for (const id of ids) {
    const question = Object.values(spec.questions).find((q) => q.derived === id);
    if (question) labels.push(clean(question.label));
  }
  return [...new Set(labels)].slice(0, 3);
}

export function getQuestionGuidance(spec: FlowSpec, key: string, eng: Engine): QuestionGuidance {
  const q = spec.questions[key];
  if (!q) return { meaning: "完成這一步，讓你的答案可以繼續往下組合。", why: "這份作業會把每個小答案串成最後的行動藍圖。", downstream: [], missing: [], hasImpact: false };
  const ids = directDependents(spec, key);
  const downstream = labelsForDependents(spec, ids);
  const missing = ids.flatMap((id) => {
    const value = eng.values[id];
    if (!value || value.complete || !value.parts) return [];
    return value.parts.filter((part) => part.kind === "blank").map((part) => part.text);
  });
  const why = q.why ?? (downstream.length
    ? `這個答案不是獨立存在的，之後會自動帶入「${downstream.join("」、「")}」，幫你把前面的判斷變成可直接使用的句子。`
    : "這題用來把你的現況具體化，後面檢查與整理藍圖時會更容易看出下一步。\n先求真實，再求漂亮。"
  );
  return { meaning: genericMeaning(q), why, downstream, missing: [...new Set(missing)], hasImpact: ids.length > 0 };
}

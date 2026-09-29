import fs from "node:fs";
import YAML from "yaml";

const input = JSON.parse(fs.readFileSync("docs/flow/baseline/stage-02.fields.json", "utf8"));
const tasks = {}, questions = {}, pages = {}, parts = [];
const labels = {
  "stage-02-2-1": "任務 2.1｜把市場拆開來看",
  "stage-02-2-2": "任務 2.2｜把客人縮成一個人",
  "stage-02-2-3": "任務 2.3｜寫出你的定位句",
  "stage-02-2-4": "任務 2.4｜訂出產品與價格",
  "stage-02-2-5": "任務 2.5｜組出你的成交方案",
  "stage-02-附錄": "附錄｜一頁定位藍圖",
};
const slugs = { "stage-02-2-1": "t21", "stage-02-2-2": "t22", "stage-02-2-3": "t23", "stage-02-2-4": "t24", "stage-02-2-5": "t25", "stage-02-附錄": "app" };
const chapters = {
  "stage-02-2-1": "2.1 市場調查與市場分析",
  "stage-02-2-2": "2.2 受眾與用戶畫像的選擇",
  "stage-02-2-3": "2.3 獨特的精準定位",
  "stage-02-2-4": "2.4 好產品與高價格",
  "stage-02-2-5": "2.5 賣爆的成交環節",
};
const clean = (s) => String(s ?? "").replace(/\r/g, "").trim();
const kindOf = (f) => f.type === "textarea" ? "textarea" : f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "checkboxes" ? (f.multiple ? "multi" : "single") : "text";

for (const task of input) {
  const taskKey = task.task, slug = slugs[taskKey];
  tasks[slug] = taskKey;
  const grouped = new Map();
  for (const [index, field] of task.fields.entries()) {
    if (field.hiddenInGroup) continue;
    const key = `stage2.${slug}.q${index}`, kind = kindOf(field);
    const q = { kind, label: clean(field.prompt) || "請完成這一題", task: taskKey, optional: field.required === false, legacyKeys: [field.key], origin: "source", sourceRef: { file: "作業", heading: clean(field.sourceSectionKey || taskKey) } };
    if (field.options?.length) q.options = field.options.map((option, i) => ({ id: `o${i}`, label: clean(option.label) || `選項 ${i + 1}`, other: /其他/.test(option.label) }));
    questions[key] = q;
    const section = clean(field.sourceSectionKey || taskKey);
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section).push({ key, kind });
  }
  const ids = [];
  if (chapters[taskKey]) {
    const id = `p.${slug}.lecture`;
    pages[id] = { title: `${labels[taskKey]}｜先讀講義`, lectureChapter: chapters[taskKey], blocks: [] };
    ids.push(id);
  }
  for (const [section, items] of grouped) {
    const sectionSlug = section === "任務" ? "summary" : (section.replace(/[^0-9A-Za-z]+/g, "").toLowerCase() || "summary");
    const id = `p.${slug}.${sectionSlug}`;
    const blocks = [{ type: "prose", text: "一頁完成一個小步驟。你可以先填一部分，答案會保留在工作區，之後再回來補。", origin: "authored" }];
    for (const item of items) blocks.push(item.kind === "single" || item.kind === "multi" ? { type: "choice", q: item.key, columns: 1 } : { type: item.kind, q: item.key });
    pages[id] = { title: `${labels[taskKey]}｜${section}`, task: taskKey, sourceRef: section === "任務" ? undefined : { file: "作業", heading: section }, blocks };
    ids.push(id);
  }
  parts.push({ label: labels[taskKey], pages: ids });
}

const d = {};
const add = (key, value) => { d[key] = value; };
const q = (slug, index) => `stage2.${slug}.q${index}`;
const addReadout = (pageId, derived, title) => pages[pageId]?.blocks.push({ type: "readout", derived, title });
const addCheck = (pageId, derived) => pages[pageId]?.blocks.push({ type: "check", derived });
const replaceBlock = (pageId, question, block) => {
  const page = pages[pageId];
  if (!page) return;
  const found = page.blocks.findIndex((item) => item.q === question);
  if (found >= 0) page.blocks[found] = block;
};
const band = (input, suffix) => ({ op: "band", input, output: "label", suffix, bands: [
  { min: 0, max: 0, label: "尚未建立", detail: "先完成這一題，系統才會計分。" },
  { min: 1, max: 1, label: "起步中", detail: "已有一個可用的支撐點。" },
  { min: 2, max: 2, label: "有基礎", detail: "已有兩個支撐點，可以再補強成功機率。" },
  { min: 3, max: 3, label: "站得住", detail: "這一格已達到本題最高分。" },
], incomplete: "完成選擇後自動判定。" });

add("stage2.t23.position_auto", { op: "template", template: "對【{{stage2.t23.q13}}】而言，我是唯一{{stage2.t23.q10}}的定位服務，因為{{stage2.t23.q15}}。", blank: "＿＿＿＿", origin: "source-derived", sourceRef: { file: "作業", heading: "2.3-B" } });
questions[q("t23", 14)].derived = "stage2.t23.position_auto";
questions[q("t23", 14)].origin = "source-derived";
replaceBlock("p.t23.23b", q("t23", 14), { type: "sentence", q: q("t23", 14), title: "定位句（自動組合，可直接修改）", multiline: true });
add("stage2.t23.short_check", { op: "charCount", inputs: [q("t23", 25)], max: 15, unit: "字", good: "目前 {{n}} 字，符合 15 字以內。", bad: "目前 {{n}} 字，請再濃縮到 {{max}} 字以內。", incomplete: "先填寫濃縮版，系統會自動檢查。", origin: "source-derived", sourceRef: { file: "作業", heading: "2.3-D" } });
add("stage2.t23.opposition_check", { op: "cases", cases: [
  { when: { inputs: [q("t23", 11), q("t23", 12)], allEqual: "o0" }, template: "兩題都答「會」：這句定位已經有立場。", tone: "good" },
  { when: { else: true }, template: "至少有一題還沒答「會」：回到 2.3-A 把主張再說尖一點。", tone: "neutral" },
], origin: "source-derived", sourceRef: { file: "作業", heading: "2.3-C" } });
add("stage2.t23.tests_check", { op: "cases", cases: [
  { when: { inputs: [q("t23", 17), q("t23", 19), q("t23", 22)], allEqual: "o0" }, template: "複述、反對、排除三項都已通過。", tone: "good" },
  { when: { else: true }, template: "三項測試尚未全部通過；請依下方勾選結果回頭修改。", tone: "neutral" },
], origin: "source-derived", sourceRef: { file: "作業", heading: "2.3-C" } });
addCheck("p.t23.23c", "stage2.t23.opposition_check");
addCheck("p.t23.23c", "stage2.t23.tests_check");
addCheck("p.t23.23d", "stage2.t23.short_check");

const t24Scores = [
  ["leverage1", q("t24", 0), { o0: 1, o1: 2, o2: 3, o3: 0 }],
  ["leverage2", q("t24", 2), { o0: 1, o1: 1, o2: 1, o3: 1, o4: 1, o5: 1 }],
  ["leverage3", q("t24", 4), { o0: 3, o1: 3, o2: 2, o3: 1, o4: 0 }],
  ["leverage4", q("t24", 6), { o0: 1, o1: 1, o2: 1, o3: 1, o4: 0 }],
];
for (const [name, input, weights] of t24Scores) {
  const score = `stage2.t24.${name}.score`;
  add(score, { op: "weightedCount", inputs: [input], weights, cap: 3, suffix: " 分", incomplete: "完成選擇後自動計分。", origin: "source-derived", sourceRef: { file: "作業", heading: "2.4-A" } });
  add(`${score}.label`, { ...band(score), origin: "source-derived", sourceRef: { file: "作業", heading: "2.4-A" } });
  addReadout("p.t24.24a", score, `${name === "leverage1" ? "槓桿 1｜結果多想要" : name === "leverage2" ? "槓桿 2｜成功機率多高" : name === "leverage3" ? "槓桿 3｜多快拿到" : "槓桿 4｜多輕鬆"}｜自動分數`);
  addCheck("p.t24.24a", `${score}.label`);
}

const t25Scores = [
  ["concern1", q("t25", 0), { o0: 1, o1: 1, o2: 1, o3: 1, o4: 0 }],
  ["concern2", q("t25", 2), { o0: 1, o1: 1, o2: 1, o3: 1, o4: 1, o5: 0 }],
  ["concern3", q("t25", 4), { o0: 3, o1: 2, o2: 2, o3: 0 }],
];
for (const [name, input, weights] of t25Scores) {
  const score = `stage2.t25.${name}.score`;
  add(score, { op: "weightedCount", inputs: [input], weights, cap: 3, suffix: " 分", incomplete: "完成選擇後自動計分。", origin: "source-derived", sourceRef: { file: "作業", heading: "2.5-A" } });
  add(`${score}.label`, { ...band(score), origin: "source-derived", sourceRef: { file: "作業", heading: "2.5-A" } });
  addReadout("p.t25.25a", score, `${name === "concern1" ? "疑慮 1｜我不信這有用" : name === "concern2" ? "疑慮 2｜我不信我做得到" : "疑慮 3｜我不急"}｜自動強度`);
  addCheck("p.t25.25a", `${score}.label`);
}

add("stage2.t22.audience_auto", { op: "template", template: "{{stage2.t22.q7}}（{{stage2.t22.q8}}歲，{{stage2.t22.q9}}）", blank: "＿＿＿＿", origin: "source-derived", sourceRef: { file: "作業", heading: "2.2-A" } });
add("stage2.t24.product_price_auto", { op: "joinNonEmpty", inputs: [q("t24", 14), q("t24", 15)], sep: "｜NT$ ", end: "", requireAll: false, origin: "source-derived", sourceRef: { file: "作業", heading: "2.4-C" } });
add("stage2.app.audience", { op: "firstNonEmpty", inputs: ["stage2.t22.audience_auto", q("t22", 1)], origin: "source-derived", sourceRef: { file: "作業", heading: "附錄：一頁定位藍圖" } });
add("stage2.app.moment", { op: "firstNonEmpty", inputs: [q("t22", 25), q("t22", 26)], origin: "source-derived", sourceRef: { file: "作業", heading: "2.2-B" } });
add("stage2.app.offer", { op: "firstNonEmpty", inputs: [q("t25", 9), q("t25", 13)], origin: "source-derived", sourceRef: { file: "作業", heading: "2.5-B" } });
const blueprint = [
  ["沒有人在講的是", "stage2.t21.q30"], ["我的客人是", "stage2.app.audience"], ["他的那個時刻", "stage2.app.moment"],
  ["大家都覺得＿＿，但我主張＿＿", "stage2.t23.position_auto"], ["我的定位句（15 字以內）", "stage2.t23.q25"],
  ["我的主力產品與價格", "stage2.t24.product_price_auto"], ["我最有力的那一句", "stage2.app.offer"],
].map(([label, value]) => ({ label, value, fallback: "暫定", multiline: true }));
const out = { schemaVersion: 1, stage: "stage-02", title: "階段二：賣爆賺錢的商業定位", tasks, flows: { self_study: { label: "自己完成", parts } }, pages, questions, tables: {}, derived: d, blueprint: { sections: [{ title: "一頁定位藍圖", items: blueprint }] }, dropped: [] };
fs.writeFileSync("content/source/stage-02/flow.yaml", YAML.stringify(out, { lineWidth: 0 }));
console.log(`generated ${Object.keys(questions).length} questions, ${Object.keys(pages).length} pages`);

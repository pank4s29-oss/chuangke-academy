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
const blueprint = [
  ["沒有人在講的是", "stage2.t21.q24"], ["我的客人是", "stage2.t22.q2"], ["他的那個時刻", "stage2.t22.q23"],
  ["大家都覺得＿＿，但我主張＿＿", "stage2.t23.q12"], ["我的定位句（15 字以內）", "stage2.t23.q26"],
  ["我的主力產品與價格", "stage2.t24.q20"], ["我最有力的那一句", "stage2.t25.q14"],
].map(([label, value]) => ({ label, value, fallback: "暫定", multiline: true }));
const out = { schemaVersion: 1, stage: "stage-02", title: "階段二：賣爆賺錢的商業定位", tasks, flows: { self_study: { label: "自己完成", parts } }, pages, questions, tables: {}, derived: {}, blueprint: { sections: [{ title: "一頁定位藍圖", items: blueprint }] }, dropped: [] };
fs.writeFileSync("content/source/stage-02/flow.yaml", YAML.stringify(out, { lineWidth: 0 }));
console.log(`generated ${Object.keys(questions).length} questions, ${Object.keys(pages).length} pages`);

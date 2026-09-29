import type { FlowDocument } from "./schema";
export type ValidationIssue = { level: "error" | "warning"; path: string; message: string };
const KEY = /^stage\d+\.[a-z0-9_]+(?:\.[a-z0-9_]+){1,2}$/;
export function validateFlow(document: FlowDocument, sourceMarkdown = "") {
  const issues: ValidationIssue[] = []; const questionKeys = new Set(Object.keys(document.questions));
  for (const key of questionKeys) if (!KEY.test(key)) issues.push({ level: "error", path: `questions.${key}`, message: "題目 key 不符合語意命名規則" });
  const pages = Object.values(document.flows).flatMap((flow) => flow.pages); const pageIds = new Set(pages.map((page) => page.id));
  for (const [flowId, flow] of Object.entries(document.flows)) for (const part of flow.parts) for (const pageId of part.pageIds) if (!pageIds.has(pageId)) issues.push({ level: "error", path: `flows.${flowId}.parts`, message: `找不到頁面 ${pageId}` });
  for (const page of pages) for (const block of page.blocks) if (block.key && block.type !== "blueprint" && !questionKeys.has(block.key) && !document.derived[block.key]) issues.push({ level: "error", path: `pages.${page.id}.${block.key}`, message: "block 引用不存在的題目或衍生值" });
  for (const [key, value] of Object.entries(document.legacyKeyMap)) if (!questionKeys.has(value) && !document.derived[value]) issues.push({ level: "error", path: `legacyKeyMap.${key}`, message: `alias 目標不存在：${value}` });
  for (const page of pages) if (page.sourceRef?.heading && sourceMarkdown && !sourceMarkdown.includes(page.sourceRef.heading)) issues.push({ level: "warning", path: `pages.${page.id}.sourceRef`, message: `找不到來源標題：${page.sourceRef.heading}` });
  return { ok: !issues.some((item) => item.level === "error"), issues };
}

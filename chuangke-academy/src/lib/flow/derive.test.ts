import { describe, expect, it } from "vitest";
import { deriveValue } from "./derive";

describe("flow derive", () => {
  it("組合句子並保留未填佔位", () => expect(deriveValue("template", ["state", "identity"], { state: "想變瘦", identity: "上班族" }, { template: "我服務的是{{state}}的{{identity}}。", blank: "＿＿" })).toBe("我服務的是想變瘦的上班族。"));
  it("只串接非空答案", () => expect(deriveValue("joinNonEmpty", ["a", "b", "c"], { a: "試過", b: "", c: "沒效果" }, { separator: "，", end: "。" })).toBe("試過，沒效果。"));
  it("檢查學會禁用詞", () => expect(deriveValue("regexAbsent", ["to"], { to: "學會投廣告" }, { pattern: "學會" })).toEqual({ value: "學會投廣告", ok: false }));
  it("計算自我檢測分數", () => expect(deriveValue("countEquals", ["a", "b", "c"], { a: "是", b: "否", c: "是" }, { equals: "是" })).toBe(2));
});

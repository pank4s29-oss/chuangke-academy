import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { composeLegacyAnswers } from "./compositions";
import { readTaskSectionsWithFieldsFromSources } from "./taskSections";

// Uses the REAL per-task field lists of the whole stage, exactly like TaskFlow's `allFields`.
const dir = path.join(process.cwd(), "content/source/stage-01");
const files = fs.readdirSync(dir);
const assignment = fs.readFileSync(path.join(dir, files.find((f) => f.includes("作業"))!), "utf8");
const lecture = fs.readFileSync(path.join(dir, files.find((f) => f.includes("講義"))!), "utf8");
const tasks = readTaskSectionsWithFieldsFromSources("stage-01", assignment, lecture);
const fields = tasks.flatMap((t) => t.fields);
const F = new Map(fields.map((f) => [f.key, f]));
const opt = (task: string, n: number, i: number) => F.get(`stage-01-${task}-answer-${n}`)!.options![i].key;
const label = (task: string, n: number, i: number) => F.get(`stage-01-${task}-answer-${n}`)!.options![i].label;
type A = Record<string, string | string[]>;
/** Simulates TaskFlow.updateAnswer one change at a time. */
const change = (answers: A, key: string, value: string | string[]): A => composeLegacyAnswers(fields, { ...answers, [key]: value }, key, answers).answers as A;

describe("Stage 1 legacy carry-over (whole-stage field list)", () => {
  it("把三格串起來 works with every task's fields present, and uses the 其他 text", () => {
    let a: A = {};
    a = change(a, "stage-01-1-answer-5", opt("1", 5, 0));
    a = change(a, "stage-01-1-answer-7", opt("1", 7, 1));
    a = change(a, "stage-01-1-answer-8", opt("1", 8, 0));
    expect(a["stage-01-1-answer-10"]).toBe(`${label("1", 5, 0)}，${label("1", 7, 1)}，${label("1", 8, 0)}。`);
    const other = F.get("stage-01-1-answer-5")!.options!.findIndex((o) => o.otherInputKey);
    a = change(a, "stage-01-1-answer-5", opt("1", 5, other));
    a = change(a, F.get("stage-01-1-answer-5")!.options![other].otherInputKey!, "我自學了三個月");
    expect(String(a["stage-01-1-answer-10"]).startsWith("我自學了三個月，")).toBe(true);
  });

  it("keeps a hand-edited sentence until it is cleared, then re-links", () => {
    let a: A = {};
    a = change(a, "stage-01-1-answer-5", opt("1", 5, 0));
    a = change(a, "stage-01-1-answer-10", "我自己寫的抱怨");
    a = change(a, "stage-01-1-answer-7", opt("1", 7, 0));
    expect(a["stage-01-1-answer-10"]).toBe("我自己寫的抱怨");
    a = change(a, "stage-01-1-answer-10", "");
    a = change(a, "stage-01-1-answer-8", opt("1", 8, 0));
    expect(String(a["stage-01-1-answer-10"])).toContain(label("1", 7, 0));
  });

  it("carries 1-A into 4-A / 4-D and the appendix; 4-B, 4-C follow the ticks", () => {
    let a: A = {};
    a = change(a, "stage-01-1-answer-0", opt("1", 0, 2));
    a = change(a, "stage-01-1-answer-2", "紋繡師");
    const sentence = `我服務的是【${label("1", 0, 2)}】的【紋繡師】。`;
    expect(a["stage-01-1-answer-3"]).toBe(sentence);
    expect(a["stage-01-4-answer-0"]).toBe(`我要找的人是【${label("1", 0, 2)}】的【紋繡師】。`);
    expect(a["stage-01-4-answer-18"]).toBe(`${label("1", 0, 2)}的紋繡師`);
    expect(a["stage-01-附錄-answer-0"]).toBe(sentence);
    a = change(a, "stage-01-4-answer-8", [opt("4", 8, 0), opt("4", 8, 2)]);
    a = change(a, "stage-01-4-answer-10", [opt("4", 10, 1)]);
    const no = `${label("4", 8, 0)}、${label("4", 8, 2)}、${label("4", 10, 1)}`;
    expect(a["stage-01-4-answer-12"]).toBe(no);
    expect(a["stage-01-4-answer-19"]).toBe(no);
    expect(a["stage-01-附錄-answer-4"]).toBe(no);
    a = change(a, "stage-01-4-answer-13", [opt("4", 13, 3), opt("4", 13, 0)]);
    expect([15, 16, 17].map((n) => a[`stage-01-4-answer-${n}`])).toEqual([label("4", 13, 3), label("4", 13, 0), ""]);
    expect(a["stage-01-4-answer-20"]).toBe(label("4", 13, 3));
    expect(a["stage-01-附錄-answer-5"]).toBe(label("4", 13, 3));
  });

  it("3-B counts the 是 answers once all six are answered; 3-C lists the empty boxes", () => {
    let a: A = {};
    [8, 9, 10, 11, 12].forEach((n, i) => { a = change(a, `stage-01-3-answer-${n}`, opt("3", n, i % 2)); });
    expect(a["stage-01-3-answer-14"]).toBe(""); // one question still open
    a = change(a, "stage-01-3-answer-13", opt("3", 13, 0));
    expect(a["stage-01-3-answer-14"]).toBe("4");
    a = change(a, "stage-01-3-answer-0", [opt("3", 0, 4)]);
    a = change(a, "stage-01-3-answer-2", [opt("3", 2, 2)]);
    a = change(a, "stage-01-3-answer-4", [opt("3", 4, 3)]);
    a = change(a, "stage-01-3-answer-6", [opt("3", 6, 0)]);
    expect(a["stage-01-3-answer-15"]).toBe("1、3");
  });

  it("appendix takes the chosen 1-C sentence, the 2-A top quote before the 1-B one, and 5-A's date", () => {
    let a: A = {};
    a = change(a, "stage-01-1-answer-13", opt("1", 13, 1));
    a = change(a, "stage-01-1-answer-15", "我有一套【三堂式教學】，專門解決【學了不會用】。");
    expect(a["stage-01-附錄-answer-2"]).toBe("我有一套【三堂式教學】，專門解決【學了不會用】。");
    a = change(a, "stage-01-1-answer-11", "我幫他解決的問題是，從【接不到客人】，變成【每月穩定三位】。");
    expect(a["stage-01-附錄-answer-1"]).toBe("從接不到客人，變成每月穩定三位");
    a = change(a, "stage-01-1-answer-10", "花了很多錢，完全沒有改變。");
    expect(a["stage-01-附錄-answer-3"]).toBe("花了很多錢，完全沒有改變。");
    a = change(a, "stage-01-2-answer-20", "沒有人教我怎麼接案");
    expect(a["stage-01-附錄-answer-3"]).toBe("沒有人教我怎麼接案");
    a = change(a, "stage-01-5-answer-1", "10月30日");
    expect(a["stage-01-附錄-answer-6"]).toBe("10月30日");
    // an unfilled pattern is not carried over
    a = change(a, "stage-01-1-answer-13", opt("1", 13, 0));
    expect(a["stage-01-附錄-answer-2"]).toBe("");
  });
});

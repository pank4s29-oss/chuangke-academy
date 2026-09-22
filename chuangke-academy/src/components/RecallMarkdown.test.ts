import { describe, expect, it } from "vitest";
import { readStageTasks } from "../lib/content/taskSections";
import { buildSectionIndex, resolveTarget, referenceParts } from "./RecallMarkdown";

const stage1 = readStageTasks("stage-01");
const stage2 = readStageTasks("stage-02");
const allTasks = [...stage1, ...stage2];
const index = buildSectionIndex(allTasks);

function fieldFor(target: ReturnType<typeof resolveTarget>) {
  if (!target?.fieldKey) return undefined;
  return target.task.fields.find((field) => field.key === target.fieldKey);
}

describe("RecallMarkdown 跨題引用解析", () => {
  it('"抄 1.1-B 步驟 2 那句「他會親口說的話」" 要指向步驟 2 組出的那句話，不是步驟 1 的勾選題', () => {
    const target = resolveTarget("1.1-B", "步驟 2 那句「他會親口說的話」", index, {});
    const field = fieldFor(target);
    expect(field?.key).toBe("stage-01-1-answer-10");
    expect(field?.prompt).toContain("①＋②＋③");
  });

  it('沒有限定詞的 "1.1-B" 落回該小節最後一格（步驟 3 的合成句），而不是第一格的勾選題', () => {
    const target = resolveTarget("1.1-B", "那句是你還沒去撿原話", index, {});
    const field = fieldFor(target);
    expect(field?.key).toBe("stage-01-1-answer-11");
  });

  it('"翻回 1.2-E，你有沒有勾 D" 要指向 A–E 那一題本身，而不是後面「選填」的關鍵字欄位', () => {
    const target = resolveTarget("1.2-E", "，你有沒有勾 D", index, {});
    const field = fieldFor(target);
    expect(field?.key).toBe("stage-01-2-answer-40");
    expect(field?.type).toBe("checkboxes");
  });

  it('"2.1-A 恐懼層" 要指向恐懼那一列，不是表面痛那一列', () => {
    const target = resolveTarget("2.1-A", "恐懼層）", index, {});
    const field = fieldFor(target);
    expect(field?.tableRow).toBe("恐懼");
  });

  it('"2.1-A 中間那層" 要指向「真正要的結果」那一列', () => {
    const target = resolveTarget("2.1-A", "中間那層）", index, {});
    const field = fieldFor(target);
    expect(field?.tableRow).toBe("真正要的結果");
  });

  it("1.1-C 的三選一切角句，會依照學員實際勾選的分支帶出對應那一句，而不是永遠帶「經歷型」", () => {
    const branchField = stage1.find((t) => t.key === "stage-01-1")!.fields.find((f) => f.prompt.includes("現在先用 A 或 B"))!;
    const methodOption = branchField.options!.find((o) => o.label.includes("方法型"))!;

    const targetNoAnswer = resolveTarget("1.1-C", "", index, {});
    expect(fieldFor(targetNoAnswer)?.key).toBe("stage-01-1-answer-14"); // 預設帶第一個分支（經歷型）

    const targetMethod = resolveTarget("1.1-C", "", index, { "stage-01": { [branchField.key]: [methodOption.key] } });
    expect(fieldFor(targetMethod)?.key).toBe("stage-01-1-answer-15"); // 學員實際勾了方法型，就要帶方法型那一句
  });

  it("referenceParts 能正確拆出跨階段代碼", () => {
    expect(referenceParts("1.2-E")).toEqual({ stageKey: "stage-01", taskKey: "stage-01-2", sectionKey: "2-E" });
    expect(referenceParts("2.3-B")).toEqual({ stageKey: "stage-02", taskKey: "stage-02-2-3", sectionKey: "2.3-B" });
  });
});

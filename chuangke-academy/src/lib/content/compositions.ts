import { describe, expect, it } from "vitest";
import { composeLegacyAnswers } from "./compositions";
import { hasEmptySlot } from "./fieldState";
import type { AssignmentField } from "./taskSections";

const field = (key: string, prompt: string, type: AssignmentField["type"], options?: AssignmentField["options"]): AssignmentField => ({ key, prompt, type, options });

describe("legacy assignment compositions", () => {
  it("uses the selected option label and identity in the Stage 1 first sentence", () => {
    const fields = [
      field("stage-01-1-answer-0", "他跟這個問題走到哪一步", "checkboxes", [
        { key: "stage-01-1-option-0-0", label: "A. 還沒動作" },
        { key: "stage-01-1-option-0-2", label: "C. 花過錢找別人解決，但沒解決" },
      ]),
      field("stage-01-1-answer-1", "這件事有在賺錢嗎", "checkboxes", [{ key: "stage-01-1-option-1-0", label: "有" }]),
      field("stage-01-1-answer-2", "寫出被服務的身分", "text"),
      field("stage-01-1-answer-3", "把上面兩格套進句子", "text"),
    ];
    const result = composeLegacyAnswers(fields, {
      "stage-01-1-answer-0": "stage-01-1-option-0-2",
      "stage-01-1-answer-2": "紋繡師",
    });
    expect(result.answers["stage-01-1-answer-3"]).toBe("我服務的是【C. 花過錢找別人解決，但沒解決】的【紋繡師】。");
    expect(result.generated).toContain("stage-01-1-answer-3");
  });

  it("rebuilds the sentence when the earlier answer changes", () => {
    const fields = [
      field("stage-01-1-answer-0", "狀態", "checkboxes", [{ key: "stage-01-1-option-0-0", label: "A. 還沒動作" }]),
      field("stage-01-1-answer-2", "身分", "text"),
      field("stage-01-1-answer-3", "把上面兩格套進句子", "text"),
    ];
    const first = composeLegacyAnswers(fields, { "stage-01-1-answer-0": "stage-01-1-option-0-0", "stage-01-1-answer-2": "上班族" });
    const second = composeLegacyAnswers(fields, { ...first.answers, "stage-01-1-answer-2": "國中生家長" });
    expect(second.answers["stage-01-1-answer-3"]).toContain("國中生家長");
    expect(second.answers["stage-01-1-answer-3"]).not.toContain("上班族");
  });

  it("preserves a direct sentence edit when that sentence is the changed field", () => {
    const fields = [
      field("stage-01-1-answer-0", "狀態", "checkboxes", [{ key: "stage-01-1-option-0-0", label: "A. 還沒動作" }]),
      field("stage-01-1-answer-2", "身分", "text"),
      field("stage-01-1-answer-3", "把上面兩格套進句子", "text"),
    ];
    const result = composeLegacyAnswers(fields, { "stage-01-1-answer-0": "stage-01-1-option-0-0", "stage-01-1-answer-2": "上班族", "stage-01-1-answer-3": "我服務的是我自己改的句子" }, "stage-01-1-answer-3");
    expect(result.answers["stage-01-1-answer-3"]).toBe("我服務的是我自己改的句子");
  });

  it("inserts the 1-B step 3 and 1-C sentence patterns when empty, without overwriting typed text", () => {
    const fields = [
      field("stage-01-1-answer-11", "句型： 我幫他解決的問題是，從現在的狀況，變成他想要的樣子", "text"),
      field("stage-01-1-answer-14", "句型： 我以前也和他一樣的狀況，後來我做了什麼改變", "text"),
      field("stage-01-1-answer-15", "句型： 我有一套方法名稱，專門解決什麼問題", "text"),
      field("stage-01-1-answer-16", "句型： 我做過具體的事，達成具體的數字或結果", "text"),
    ];
    const first = composeLegacyAnswers(fields, {});
    expect(String(first.answers["stage-01-1-answer-11"])).toMatch(/^我幫他解決的問題是，從【＿+】，變成【＿+】。$/);
    expect(String(first.answers["stage-01-1-answer-14"])).toMatch(/^我以前也【＿+】，後來我【＿+】。$/);
    expect(String(first.answers["stage-01-1-answer-15"])).toMatch(/^我有一套【＿+】，專門解決【＿+】。$/);
    expect(String(first.answers["stage-01-1-answer-16"])).toMatch(/^我做過【＿+】，達成【＿+】。$/);
    const typed = composeLegacyAnswers(fields, { "stage-01-1-answer-11": "我幫他解決的問題是，從【A】，變成【B】。" });
    expect(typed.answers["stage-01-1-answer-11"]).toBe("我幫他解決的問題是，從【A】，變成【B】。");
    const cleared = composeLegacyAnswers(fields, { "stage-01-1-answer-11": "" }, "stage-01-1-answer-11");
    expect(cleared.answers["stage-01-1-answer-11"]).toBe("");
  });
  it("a pattern with an empty slot does not count as answered", () => {
    expect(hasEmptySlot("我做過【＿＿＿＿】，達成【三年】。")).toBe(true);
    expect(hasEmptySlot("我做過【三年帶班】，達成【200 人完課】。")).toBe(false);
  });
});

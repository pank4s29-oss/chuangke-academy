import { describe, expect, it } from "vitest";
import { composeLegacyAnswers } from "./compositions";
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
});

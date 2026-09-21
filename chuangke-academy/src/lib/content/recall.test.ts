import { describe, expect, it } from "vitest";
import { buildRecallAnswers } from "./recall";
import type { TaskWithFields } from "./taskSections";

const tasks = [] as TaskWithFields[];

describe("跨階段作業回顧帶入", () => {
  it("會把階段一的核心答案帶到階段二指定欄位", () => {
    const result = buildRecallAnswers("stage-02", tasks, {
      "stage-01": {
        "stage-01-1-answer-3": "想多一份收入的上班族",
        "stage-01-1-answer-10": "我不知道從哪裡開始",
        "stage-01-2-answer-20": "副業看了一堆，看完還是不知道要幹嘛。",
        "stage-01-2-answer-22": "美甲教學",
      },
    }, {});
    expect(result.answers["stage-02-2-1-answer-1"]).toBe("我不知道從哪裡開始");
    expect(result.answers["stage-02-2-1-answer-4"]).toBe("副業看了一堆，看完還是不知道要幹嘛。");
    expect(result.answers["stage-02-2-2-answer-1"]).toBe("想多一份收入的上班族");
    expect(result.count).toBeGreaterThanOrEqual(3);
  });

  it("不會覆蓋學員已經修改過的答案", () => {
    const result = buildRecallAnswers("stage-02", tasks, {
      "stage-01": { "stage-01-1-answer-10": "舊答案" },
    }, { "stage-02-2-1-answer-1": "學員自己改過的新答案" });
    expect(result.answers["stage-02-2-1-answer-1"]).toBe("學員自己改過的新答案");
  });
});

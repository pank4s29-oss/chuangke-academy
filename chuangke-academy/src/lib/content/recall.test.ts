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

  it("會把附錄藍圖的同題答案自動帶入", () => {
    const result = buildRecallAnswers("stage-01", tasks, {
      "stage-01": {
        "stage-01-1-answer-3": "我服務的是已花過錢的美睫師",
        "stage-01-1-answer-11": "從接不到客人變成穩定接案",
        "stage-01-1-answer-14": "我以前也接不到客人，後來建立流程",
        "stage-01-2-answer-20": "總是接不到穩定客人",
        "stage-01-4-answer-12": "只想要保證結果的人",
        "stage-01-4-answer-15": "你現在每月有幾位新客？",
        "stage-01-5-answer-0": "10 月 1 日",
      },
    }, {});
    expect(result.answers["stage-01-附錄-answer-0"]).toBe("我服務的是已花過錢的美睫師");
    expect(result.answers["stage-01-附錄-answer-3"]).toBe("總是接不到穩定客人");
    expect(result.answers["stage-01-附錄-answer-5"]).toBe("你現在每月有幾位新客？");
  });
});

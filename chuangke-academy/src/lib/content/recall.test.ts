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

  it("2.3-B 第 1 格要照 2.2-A 的二選一結果帶入，勾人選 2 就不能還帶人選 1", () => {
    const choseSecond = buildRecallAnswers("stage-02", tasks, {
      "stage-02": {
        "stage-02-2-2-answer-1": "我服務的是想多一份收入的上班族",
        "stage-02-2-2-answer-2": "原話裡一直出現的是全職媽媽",
        "stage-02-2-2-answer-3": ["stage-02-2-2-option-3-1"],
      },
    }, {});
    expect(choseSecond.answers["stage-02-2-3-answer-13"]).toBe("原話裡一直出現的是全職媽媽");

    const choseFirst = buildRecallAnswers("stage-02", tasks, {
      "stage-02": {
        "stage-02-2-2-answer-1": "我服務的是想多一份收入的上班族",
        "stage-02-2-2-answer-2": "原話裡一直出現的是全職媽媽",
        "stage-02-2-2-answer-3": ["stage-02-2-2-option-3-0"],
      },
    }, {});
    expect(choseFirst.answers["stage-02-2-3-answer-13"]).toBe("我服務的是想多一份收入的上班族");
  });

  it("2.1-B 競品表只在有對應資料的欄位（主打什麼／最大弱點）帶入，不會把刊登多久誤填進價格帶", () => {
    const result = buildRecallAnswers("stage-02", tasks, {
      "stage-01": {
        "stage-01-2-answer-22": "美甲教學",
        "stage-01-2-answer-23": "3 個月以上",
        "stage-01-2-answer-24": "門檻低、在家就能做",
        "stage-01-2-answer-31": "報名前沒辦法先試，只能賭",
      },
    }, {});
    expect(result.answers["stage-02-2-1-answer-12"]).toBe("門檻低、在家就能做"); // 主打什麼
    expect(result.answers["stage-02-2-1-answer-15"]).toBe("報名前沒辦法先試，只能賭"); // 最大弱點
    expect(result.answers["stage-02-2-1-answer-13"]).toBeUndefined(); // 價格帶：階段一沒收集過，不應該被亂填
    expect(result.answers["stage-02-2-1-answer-11"]).toBeUndefined(); // 賣給誰：同上
  });

  it("2.4-C 三根支柱只有「明確的篩選」那一根抄 1.4-B，不會連「明確的結果」也被誤填成同一句", () => {
    const result = buildRecallAnswers("stage-02", tasks, {
      "stage-01": { "stage-01-4-answer-12": "我不收只想試試看的人" },
    }, {});
    expect(result.answers["stage-02-2-4-answer-19"]).toBe("我不收只想試試看的人");
    expect(result.answers["stage-02-2-4-answer-17"]).toBeUndefined();
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

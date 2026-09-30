import { describe, expect, it } from "vitest";
import { buildStageBlueprint, buildStageBlueprintMarkdown, type BlueprintSection } from "./blueprint";
import type { TaskWithFields } from "./taskSections";

describe("buildStageBlueprintMarkdown", () => {
  const sections: BlueprintSection[] = [
    {
      title: "任務 1：找出你的本質拷問",
      items: [
        { label: "我服務的是", value: "想多一份收入的上班族" },
        { label: "尚未填寫的欄位", value: "尚未填寫" },
      ],
    },
    {
      title: "階段一：獲客招生的商業模式｜顧問建議摘要",
      items: [
        { label: "填寫完成度", value: "5 / 6（約 83%）" },
        { label: "待補欄位（依任務）", value: "任務 1：我要找的人是、年齡大約" },
      ],
    },
  ];

  it("renders a heading, generated-at line, and one bullet per item", () => {
    const markdown = buildStageBlueprintMarkdown("階段一：獲客招生的商業模式", "小美", sections);
    expect(markdown).toContain("# 階段一：獲客招生的商業模式｜小美");
    expect(markdown).toContain("## 任務 1：找出你的本質拷問");
    expect(markdown).toContain("- **我服務的是**：想多一份收入的上班族");
    expect(markdown).toContain("## 階段一：獲客招生的商業模式｜顧問建議摘要");
    expect(markdown).toContain("- **填寫完成度**：5 / 6（約 83%）");
  });

  it("falls back to a placeholder learner name instead of leaving the heading blank", () => {
    const markdown = buildStageBlueprintMarkdown("階段一：獲客招生的商業模式", "", sections);
    expect(markdown).toContain("# 階段一：獲客招生的商業模式｜（未命名學員）");
  });

  it("renders a multi-line value (e.g. the advisor's per-task gap list) as a nested sub-list", () => {
    const multiline: BlueprintSection[] = [
      {
        title: "顧問建議摘要",
        items: [{ label: "待補欄位（依任務）", value: "任務 1：我要找的人是\n任務 2：年齡大約" }],
      },
    ];
    const markdown = buildStageBlueprintMarkdown("階段一", "小美", multiline);
    expect(markdown).toContain("- **待補欄位（依任務）**：");
    expect(markdown).toContain("  - 任務 1：我要找的人是");
    expect(markdown).toContain("  - 任務 2：年齡大約");
  });

  it("turns an old positional option key into the selected option label", () => {
    const tasks: TaskWithFields[] = [{
      key: "stage-01-1",
      title: "任務 1",
      lecture: "",
      assignment: "",
      fields: [{
        key: "stage-01-1-answer-0",
        prompt: "我服務誰",
        type: "checkboxes",
        multiple: false,
        options: [
          { key: "stage-01-1-option-0-0", label: "A. 還沒動作" },
          { key: "stage-01-1-option-0-2", label: "C. 花過錢找別人解決，但沒解決" },
        ],
      }],
    }];
    const sections = buildStageBlueprint("階段一", tasks, { "stage-01-1-answer-0": "stage-01-1-option-0-2" });
    expect(sections[0].items[0].value).toBe("C. 花過錢找別人解決，但沒解決");
  });
});

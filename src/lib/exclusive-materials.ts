export type ExclusiveMaterialType = "web" | "pdf";

export interface ExclusiveMaterialItem {
  title: string;
  description: string;
  url: string;
}

export interface ExclusiveMaterialRecord extends ExclusiveMaterialItem {
  type: ExclusiveMaterialType;
}

export const EXCLUSIVE_MATERIALS: Record<ExclusiveMaterialType, ExclusiveMaterialItem[]> = {
  web: [
    {
      title: "雅思写作高频逻辑连接词清单",
      description: "整理常用让步、递进、转折和因果连接方式，适合写作提纲和段落展开时快速查阅。",
      url: "https://example.com/exclusive/web/writing-linkers",
    },
    {
      title: "口语 Part 2 常见人物题回答框架",
      description: "覆盖人物描述题的起承转合结构，减少临场组织语言时的卡顿。",
      url: "https://example.com/exclusive/web/speaking-part2-people",
    },
  ],
  pdf: [
    {
      title: "写作 Task 2 审题与立场训练手册",
      description: "聚焦观点类、双边讨论类和利弊类题型的审题步骤与段落搭建。",
      url: "https://example.com/exclusive/pdf/writing-task2-guide.pdf",
    },
    {
      title: "听力地图题定位技巧 PDF",
      description: "集中讲解地图题常见方位表达、预判方式和错题复盘方法。",
      url: "https://example.com/exclusive/pdf/listening-map-strategy.pdf",
    },
  ],
};

export function getExclusiveMaterials(type?: string | null): ExclusiveMaterialRecord[] {
  const normalizedType = type?.trim().toLowerCase();

  if (normalizedType === "web" || normalizedType === "pdf") {
    return EXCLUSIVE_MATERIALS[normalizedType].map((item) => ({
      ...item,
      type: normalizedType,
    }));
  }

  return (Object.entries(EXCLUSIVE_MATERIALS) as [ExclusiveMaterialType, ExclusiveMaterialItem[]][])
    .flatMap(([materialType, items]) =>
      items.map((item) => ({
        ...item,
        type: materialType,
      })),
    );
}

export const WORD_REVIEW_DECKS = [
  {
    code: "wordbook",
    nameZh: "单词本复习",
    nameEn: "Wordbook Review",
    description: "用户手动收藏的单词会进入这里集中复习。",
  },
  {
    code: "ielts_core_6",
    nameZh: "雅思 6 分核心词汇",
    nameEn: "IELTS Band 6 Core Vocabulary",
    description: "适合夯实听说读写基础表达与高频核心词。",
  },
  {
    code: "ielts_core_7",
    nameZh: "雅思 7 分进阶词汇",
    nameEn: "IELTS Band 7 Vocabulary",
    description: "适合提升阅读、写作和口语的表达层次。",
  },
  {
    code: "ielts_topic_education",
    nameZh: "教育话题词汇",
    nameEn: "Education Topic Vocabulary",
    description: "覆盖教育制度、校园生活和政策讨论高频词。",
  },
  {
    code: "ielts_topic_environment",
    nameZh: "环境话题词汇",
    nameEn: "Environment Topic Vocabulary",
    description: "覆盖环境保护、能源、污染与可持续发展词汇。",
  },
] as const;

export type WordReviewDeckCode = (typeof WORD_REVIEW_DECKS)[number]["code"];

export function getWordReviewDeckByCode(code: string) {
  return WORD_REVIEW_DECKS.find((deck) => deck.code === code);
}

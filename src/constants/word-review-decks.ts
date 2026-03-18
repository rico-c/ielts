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
] as const;

export type WordReviewDeckCode = (typeof WORD_REVIEW_DECKS)[number]["code"];

export function getWordReviewDeckByCode(code: string) {
  return WORD_REVIEW_DECKS.find((deck) => deck.code === code);
}

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "fill_blank"
  | "matching"
  | "unknown";

export interface IeltsQuestionOption {
  label: string;
  text: string;
  sortOrder: number;
}

export interface IeltsQuestion {
  number: number;
  type: QuestionType;
  questionSubtype: string;
  part: string;
  passageNo: number | null;
  groupRef: string | null;
  subtitle: string;
  instruction: string;
  prompt: string;
  imageUrls: string[];
  answer: string;
  tableRef: string | null;
  questionMeta: Record<string, unknown>;
  options: IeltsQuestionOption[];
}

export interface IeltsTableCell {
  rowIndex: number;
  colIndex: number;
  tag: string;
  text: string;
  html: string;
  colspan: number;
  rowspan: number;
}

export interface IeltsTable {
  id: string;
  part: string;
  questionNumbers: number[];
  text: string;
  rawHtml: string;
  rows: IeltsTableCell[][];
}

export interface IeltsPart {
  part: string;
  questions: number[];
  tables: string[];
}

export interface IeltsPassage {
  id: string;
  passageNo: number;
  part: string;
  title: string;
  text: string;
  rawHtml: string;
  sortOrder: number;
}

export interface IeltsQuestionGroup {
  id: string;
  part: string;
  passageNo: number | null;
  heading: string;
  instruction: string;
  questionType: QuestionType;
  questionSubtype: string;
  questionFrom: number | null;
  questionTo: number | null;
  sharedPrompt: string;
  options: IeltsQuestionOption[];
  sortOrder: number;
}

export interface IeltsTestData {
  id: number;
  sourceUrl: string;
  sourcePageId: number | null;
  title: string;
  scrapedAt: string | null;
  series: string;
  bookNo: number | null;
  testNo: number | null;
  module: string;
  testCode: string;
  audioUrls: string[];
  parts: IeltsPart[];
  questions: IeltsQuestion[];
  tables: IeltsTable[];
  passages: IeltsPassage[];
  groups: IeltsQuestionGroup[];
}

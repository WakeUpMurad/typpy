export type Category =
  'everyday' | 'travel' | 'work' | 'real' | 'interview' | 'friends' | 'shopping' | 'meetings';
export type Mode = 'copy' | 'hint' | 'audio';
export type View = 'practice' | 'mistakes';
export interface Attribution {
  id: number;
  owner: string;
  license: string;
}
export interface Lesson {
  id: number;
  category: Category;
  en: string;
  ru: string;
  englishSource?: Attribution;
  russianSource?: Attribution;
}
export interface CheckResult {
  correct: boolean;
  expected: string;
}
export interface Progress {
  done: number[];
  mistakes: number[];
  attempts: number;
  correct: number;
}

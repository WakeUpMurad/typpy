import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, CheckResult, Mode, Progress, View } from './types';

interface TrainingStore {
  category: Category;
  index: number;
  mode: Mode;
  view: View;
  rate: string;
  voice: string;
  setVoice: (voice: string) => void;
  progress: Progress;
  setCategory: (category: Category) => void;
  setIndex: (index: number | ((previous: number) => number)) => void;
  setMode: (mode: Mode) => void;
  setView: (view: View) => void;
  setRate: (rate: string) => void;
  recordAnswer: (id: number, result: CheckResult) => void;
  finishReview: (id: number) => void;
}
const empty: Progress = { done: [], mistakes: [], attempts: 0, correct: 0 };
export const useTrainingStore = create<TrainingStore>()(
  persist(
    (set) => ({
      category: 'everyday',
      index: 0,
      mode: 'copy',
      view: 'practice',
      rate: '1',
      voice: 'en-US-JennyNeural',
      setVoice: (voice) => set({ voice }),
      progress: empty,
      setCategory: (category) => set({ category, index: 0 }),
      setIndex: (index) =>
        set((s) => ({ index: typeof index === 'function' ? index(s.index) : index })),
      setMode: (mode) => set({ mode }),
      setView: (view) => set({ view, index: 0 }),
      setRate: (rate) => set({ rate }),
      recordAnswer: (id, result) =>
        set(({ progress: p }) => ({
          progress: {
            attempts: p.attempts + 1,
            correct: p.correct + Number(result.correct),
            done: result.correct ? [...new Set([...p.done, id])] : p.done,
            mistakes: result.correct ? p.mistakes : [...new Set([...p.mistakes, id])],
          },
        })),
      finishReview: (id) =>
        set(({ progress: p }) => ({
          progress: { ...p, mistakes: p.mistakes.filter((item) => item !== id) },
        })),
    }),
    {
      name: 'typpy-training',
      version: 1,
      migrate: (saved) => ({
        ...(saved as { progress: Progress; rate: string; mode: Mode }),
        rate: '1',
      }),
      partialize: ({ progress, rate, mode, voice }) => ({ progress, rate, mode, voice }),
    },
  ),
);

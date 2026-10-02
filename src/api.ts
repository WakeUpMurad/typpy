import { useMutation, useQuery } from '@tanstack/react-query';
import type { CheckResult, Lesson } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error('Сервер недоступен. Попробуй ещё раз.');
  return response.json() as Promise<T>;
}
export function useLessons() {
  return useQuery({
    queryKey: ['lessons'],
    queryFn: () => request<Lesson[]>('/api/lessons'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
export function useCheckAnswer() {
  return useMutation({
    mutationFn: (body: { id: number; answer: string }) =>
      request<CheckResult>('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    retry: false,
  });
}

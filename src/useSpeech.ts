import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

export function useSpeech(text: string | undefined, voice: string, rate: string, mode: string) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const [error, setError] = useState('');
  const current = useRef<{
    controller: AbortController;
    audio: HTMLAudioElement;
    url?: string;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: async (controller: AbortController) => {
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || 'Не удалось получить озвучку Microsoft');
      }
      return response.blob();
    },
    retry: false,
  });
  const stop = useCallback(() => {
    const item = current.current;
    current.current = null;
    item?.controller.abort();
    if (item) {
      item.audio.onended = null;
      item.audio.onerror = null;
      item.audio.pause();
    }
    if (item?.url) URL.revokeObjectURL(item.url);
    setStatus('idle');
  }, []);
  useEffect(() => {
    stop();
    setError('');
    return stop;
  }, [text, voice, mode, stop]);
  useEffect(() => {
    if (current.current) current.current.audio.playbackRate = Number(rate);
  }, [rate]);
  async function play() {
    if (current.current) {
      const item = current.current;
      if (status === 'loading') {
        stop();
        return;
      }
      if (status === 'playing') {
        item.audio.pause();
        setStatus('paused');
        return;
      }
      try {
        await item.audio.play();
        if (current.current === item) setStatus('playing');
      } catch {
        stop();
        setError('Не удалось продолжить воспроизведение');
      }
      return;
    }
    if (!text?.trim()) {
      setError('Введи английский текст');
      return;
    }
    const item = { controller: new AbortController(), audio: new Audio(), url: '' };
    item.audio.playbackRate = Number(rate);
    current.current = item;
    setError('');
    setStatus('loading');
    try {
      const blob = await mutation.mutateAsync(item.controller);
      if (current.current !== item) return;
      item.url = URL.createObjectURL(blob);
      item.audio.src = item.url;
      item.audio.onended = stop;
      item.audio.onerror = () => {
        stop();
        setError('Не удалось воспроизвести MP3');
      };
      await item.audio.play();
      if (current.current === item) setStatus('playing');
    } catch (cause) {
      if (current.current !== item) return;
      stop();
      setError(cause instanceof Error ? cause.message : 'Не удалось озвучить');
    }
  }
  return { status, error, play, stop };
}

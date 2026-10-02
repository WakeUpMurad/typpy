import { useState } from 'react';
import { Button } from '@mui/material';
import { useSpeech } from './useSpeech';
import { useTrainingStore } from './store';

export function SpeechDemo() {
  const [text, setText] = useState('Hello! This is a test of the Microsoft English neural voice.');
  const { voice, rate } = useTrainingStore();
  const speech = useSpeech(text, voice, rate, 'demo');
  return (
    <details
      className="speech-demo"
      onToggle={(event) => {
        if (!event.currentTarget.open) speech.stop();
      }}
    >
      <summary>Озвучить свой английский текст</summary>
      <textarea
        aria-label="Текст для озвучки"
        value={text}
        maxLength={5000}
        onChange={(event) => setText(event.target.value)}
      />
      <Button
        onClick={() => {
          void speech.play();
        }}
      >
        {speech.status === 'loading'
          ? 'Отменить'
          : speech.status === 'playing'
            ? 'Пауза'
            : speech.status === 'paused'
              ? 'Продолжить'
              : 'Озвучить'}
      </Button>
      <span className="small">Голос и скорость — как в тренажёре</span>
      {speech.error && (
        <p role="alert" className="error-text">
          {speech.error}
        </p>
      )}
    </details>
  );
}

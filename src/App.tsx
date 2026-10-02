import { Button, MenuItem, Select, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SpeechDemo } from './SpeechDemo';
import { useSpeech } from './useSpeech';
import { categories } from './categories';
import { WordTyping } from './WordTyping';
import { useTrainingStore } from './store';
import { useLessons, useCheckAnswer } from './api';
import type { Category, Mode, CheckResult } from './types';
export function App() {
  const {
    category,
    setCategory,
    index,
    setIndex,
    mode,
    setMode,
    voice,
    setVoice,
    rate,
    setRate,
    progress,
    recordAnswer,
    finishReview,
    view,
    setView,
  } = useTrainingStore();
  const { data: lessons = [], isError: loadError, isPending: loading, refetch } = useLessons();
  const checkMutation = useCheckAnswer();
  const [wordAnswers, setWordAnswers] = useState<string[]>([]),
    [result, setResult] = useState<CheckResult | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    request = useRef(0);
  const answer = wordAnswers.join(' ');
  const pool =
    view === 'mistakes'
      ? lessons.filter((l) => progress.mistakes.includes(l.id))
      : lessons.filter((l) => l.category === category);
  const lesson = pool[index % Math.max(pool.length, 1)];
  const speech = useSpeech(lesson?.en, voice, rate, mode + view);
  const quickCategories = [
    'everyday',
    'interview',
    'work',
    ['everyday', 'interview', 'work'].includes(category) ? 'travel' : category,
  ].map((id) => categories.find((item) => item.id === id)!);
  const done = pool.filter((l) => progress.done.includes(l.id)).length;
  useEffect(() => {
    request.current++;
    setWordAnswers([]);
    setResult(null);
    setBusy(false);

    input.current?.focus();
  }, [lesson?.id, mode, view]);
  async function check(e?: FormEvent) {
    e?.preventDefault();
    if (!answer.trim() || busy || result?.correct || !lesson) return;
    const token = ++request.current;
    setBusy(true);
    setError('');
    try {
      const data = await checkMutation.mutateAsync({ id: lesson.id, answer });
      if (token !== request.current) return;
      setResult(data);
      recordAnswer(lesson.id, data);
    } catch {
      if (token === request.current) setError('Не удалось проверить ответ. Попробуй ещё раз.');
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  function next() {
    if (view === 'mistakes' && result?.correct) {
      finishReview(lesson.id);
      setWordAnswers([]);
      setResult(null);
    } else if (pool.length === 1) {
      setWordAnswers([]);
      setResult(null);
    } else setIndex((i) => (i + 1) % pool.length);
    input.current?.focus();
  }
  return (
    <div className="app">
      <aside>
        <a className="brand" href="/">
          typpy<span>✳</span>
        </a>
        <div className="small side-label">ТВОЁ ПРОСТРАНСТВО</div>
        <Button
          className={'nav ' + (view === 'practice' ? 'selected' : '')}
          onClick={() => {
            setView('practice');
            setIndex(0);
          }}
        >
          ⌨ <span>Практика</span>
          <span className="nav-arrow">↗</span>
        </Button>
        <Button
          className={'nav ' + (view === 'mistakes' ? 'selected' : '')}
          onClick={() => {
            setView('mistakes');
            setIndex(0);
          }}
        >
          ↺ <span>Работа над ошибками</span>
          <span className="count">{progress.mistakes.length}</span>
        </Button>
        <div className="side-note">
          <div className="plant">✳</div>
          <h3>
            Понемногу.
            <br />
            Но каждый день.
          </h3>
          <p>Одно предложение — ещё один шаг к свободному английскому.</p>
          <span>YOU GOT THIS ↗</span>
        </div>
        <div className="local">
          <i /> Личное пространство <span>Прогресс в этом браузере</span>
        </div>
      </aside>
      <main>
        <header>
          <span>Тренируй английский в своём ритме</span>
          <div className="profile">M</div>
        </header>
        <div className="content">
          <div className="eyebrow">LISTEN. TYPE. REMEMBER.</div>
          <div className="title-row">
            <div>
              <h1>
                {view === 'mistakes' ? 'Ошибки — часть пути.' : 'Английский на кончиках пальцев.'}
              </h1>
              <p className="subtitle">Слушай, понимай и набирай. По одному предложению за раз.</p>
            </div>
            <span className="edition">
              ТВОЯ ЕЖЕДНЕВНАЯ ПРАКТИКА
              <br />
              <b>EN → RU</b>
            </span>
          </div>
          <div className="stats">
            <div>
              <span className="stat-icon">✓</span>
              <div>
                <strong>
                  {progress.done.length}
                  <small> / {lessons.length}</small>
                </strong>
                <p>предложений освоено</p>
              </div>
            </div>
            <div>
              <span className="stat-icon">◎</span>
              <div>
                <strong>
                  {progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : 0}
                  <small>%</small>
                </strong>
                <p>верных ответов</p>
              </div>
            </div>
            <div>
              <span className="stat-icon">↺</span>
              <div>
                <strong>{progress.mistakes.length}</strong>
                <p>предложений на повторение</p>
              </div>
            </div>
          </div>
          <div className="section-heading">
            <h2>{view === 'mistakes' ? 'Ещё немного практики' : 'Выбери свою тему'}</h2>
            {view === 'practice' ? (
              <Select
                className="category-select"
                size="small"
                value={category}
                onChange={(event) => setCategory(event.target.value as Category)}
                inputProps={{ 'aria-label': 'Все темы' }}
              >
                {categories.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name} · {lessons.filter((lesson) => lesson.category === item.id).length}
                  </MenuItem>
                ))}
              </Select>
            ) : (
              <span>Исправляй и закрепляй</span>
            )}
          </div>
          {view === 'practice' && (
            <div className="topics">
              {quickCategories.map((c) => (
                <Button
                  key={c.id}
                  className={'topic ' + (category === c.id ? 'active' : '')}
                  onClick={() => {
                    setCategory(c.id);
                    setIndex(0);
                  }}
                >
                  <span className="topic-icon">{c.icon}</span>
                  <div>
                    <strong>{c.name}</strong>
                    <p>{c.sub}</p>
                    <small>
                      {lessons.filter((l) => l.category === c.id).length} предложений ·{' '}
                      {c.id === 'real' ? 'Tatoeba' : 'A2–B1'}
                    </small>
                  </div>
                  <span className="topic-check">{category === c.id ? '✓' : '↗'}</span>
                </Button>
              ))}
            </div>
          )}
          <section className="practice">
            <div className="practice-top">
              <ToggleButtonGroup
                className="tabs"
                value={mode}
                exclusive
                aria-label="Режим тренировки"
                onChange={(_, value: Mode | null) => {
                  if (value) setMode(value);
                }}
              >
                {(
                  [
                    ['copy', 'С текстом'],
                    ['hint', 'С подсказкой'],
                    ['audio', 'На слух'],
                  ] as [Mode, string][]
                ).map(([id, label]) => (
                  <ToggleButton key={id} value={id}>
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <span className="sentence-number">
                {pool.length ? String((index % pool.length) + 1).padStart(2, '0') : '00'}{' '}
                <span>/ {String(pool.length).padStart(2, '0')}</span>
              </span>
            </div>
            {lesson ? (
              <>
                <div className="sentence-area">
                  <div className="small">
                    {mode === 'audio' ? 'ПОСЛУШАЙ ПРЕДЛОЖЕНИЕ' : 'ПРЕДЛОЖЕНИЕ НА АНГЛИЙСКОМ'}{' '}
                    <span className="level">
                      {lesson.category === 'real' ? 'Tatoeba' : 'A2–B1'}
                    </span>
                  </div>
                  <WordTyping
                    text={lesson.en}
                    mode={mode}
                    values={wordAnswers}
                    firstInputRef={input}
                    readOnly={!!result?.correct}
                    onChange={(values) => {
                      request.current++;
                      setBusy(false);
                      setWordAnswers(values);
                      setResult(null);
                    }}
                    onEnter={() => {
                      if (result?.correct) next();
                      else void check();
                    }}
                  />
                  <p className="translation">{lesson.ru}</p>
                  {lesson.englishSource && lesson.russianSource && (
                    <div className="attribution">
                      Tatoeba · без конечной точки:{' '}
                      <a
                        href={`https://tatoeba.org/en/sentences/show/${lesson.englishSource.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        EN · {lesson.englishSource.owner || 'участники'}
                      </a>{' '}
                      ·{' '}
                      <a
                        href={`https://tatoeba.org/en/sentences/show/${lesson.russianSource.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        RU · {lesson.russianSource.owner || 'участники'}
                      </a>{' '}
                      ·{' '}
                      <a
                        href={
                          lesson.englishSource.license === 'CC0 1.0'
                            ? 'https://creativecommons.org/publicdomain/zero/1.0/'
                            : 'https://creativecommons.org/licenses/by/2.0/fr/'
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        EN: {lesson.englishSource.license}
                      </a>{' '}
                      ·{' '}
                      <a
                        href={
                          lesson.russianSource.license === 'CC0 1.0'
                            ? 'https://creativecommons.org/publicdomain/zero/1.0/'
                            : 'https://creativecommons.org/licenses/by/2.0/fr/'
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        RU: {lesson.russianSource.license}
                      </a>
                    </div>
                  )}
                  <div className="audio-controls">
                    <Button
                      type="button"
                      className="listen"
                      onClick={() => {
                        setError('');
                        void speech.play();
                      }}
                    >
                      {speech.status === 'playing' ? 'Ⅱ' : speech.status === 'loading' ? '◼' : '▶'}{' '}
                      {speech.status === 'loading'
                        ? 'Готовим…'
                        : speech.status === 'playing'
                          ? 'Слушаем…'
                          : speech.status === 'paused'
                            ? 'Продолжить'
                            : 'Послушать'}
                    </Button>
                    <label className="speed">
                      Скорость{' '}
                      <select
                        aria-label="Скорость озвучки"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                      >
                        <option value="0.5">0.5×</option>
                        <option value="0.65">0.65×</option>
                        <option value="0.85">0.85×</option>
                        <option value="1">1×</option>
                        <option value="1.2">1.2×</option>
                        <option value="1.5">1.5×</option>
                        <option value="2">2×</option>
                      </select>
                    </label>
                    <select
                      aria-label="Голос Microsoft"
                      value={voice}
                      onChange={(event) => setVoice(event.target.value)}
                      className="voice-select"
                    >
                      <option value="en-US-JennyNeural">Jenny · US</option>
                      <option value="en-US-GuyNeural">Guy · US</option>
                      <option value="en-US-AriaNeural">Aria · US</option>
                      <option value="en-GB-SoniaNeural">Sonia · UK</option>
                    </select>
                    <span className="audio-note">Edge Read Aloud</span>
                  </div>
                </div>
                <form id="training-answer" onSubmit={check}>
                  <div className="typing-guide">
                    <span className="typing-status">⌨ Вводи слова прямо под предложением</span>
                    <span>
                      <kbd>пробел</kbd> следующее слово
                    </span>
                  </div>
                  <div className="feedback" aria-live="polite">
                    {result ? (
                      result.correct ? (
                        <span className="success-text">
                          ✓ Отлично! Всё правильно. Переходи к следующему предложению.
                        </span>
                      ) : (
                        <span className="error-text">
                          Есть ошибка. Проверь слова и их порядок.
                          {mode !== 'copy' && (
                            <span className="expected">Правильно: {result.expected}</span>
                          )}
                        </span>
                      )
                    ) : (
                      <span>Без точки в конце. Регистр и лишние пробелы не важны.</span>
                    )}
                  </div>
                  <div className="form-bottom">
                    <span className="enter-note">
                      <kbd>↵</kbd> {result?.correct ? 'следующее предложение' : 'проверить ответ'}
                    </span>
                    <div>
                      {!result?.correct && (
                        <Button className="skip" type="button" onClick={next}>
                          Пропустить →
                        </Button>
                      )}
                      {result?.correct ? (
                        <Button className="primary" type="button" onClick={next}>
                          Дальше <span>→</span>
                        </Button>
                      ) : (
                        <Button className="primary" disabled={busy || !answer.trim()} type="submit">
                          {busy ? 'Проверяем…' : 'Проверить'} <span>↵</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </form>
              </>
            ) : (
              <div className="empty">
                <h2>
                  {loadError
                    ? 'Не удалось загрузить упражнения'
                    : loading
                      ? 'Загружаем предложения…'
                      : view === 'mistakes'
                        ? 'Пока здесь чисто ✨'
                        : 'Здесь пока нет предложений'}
                </h2>
                <p>
                  {loadError
                    ? 'Проверь, запущен ли Go-сервер.'
                    : view === 'mistakes'
                      ? 'Предложения с ошибками появятся здесь для повторения.'
                      : 'Твоя практика скоро начнётся.'}
                </p>
                {loadError && (
                  <Button className="primary" onClick={() => void refetch()}>
                    Повторить
                  </Button>
                )}
                {lessons.length > 0 && (
                  <Button className="primary" onClick={() => setView('practice')}>
                    К практике →
                  </Button>
                )}
              </div>
            )}
          </section>
          <SpeechDemo />
          {(error || speech.error) && (
            <p role="alert" className="error-text">
              {error || speech.error}
            </p>
          )}
          <div className="progress-footer">
            <span>Твой прогресс в этой теме</span>
            <div className="track">
              <i style={{ width: `${pool.length ? (done / pool.length) * 100 : 0}%` }} />
            </div>
            <b>
              {done} / {pool.length}
            </b>
          </div>
          <footer>
            <span>Маленькая привычка. Большая разница.</span>
            <span>
              Сделано для твоего английского <b>✳</b>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

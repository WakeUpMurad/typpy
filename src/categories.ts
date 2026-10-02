import type { Category } from './types';

export const categories: { id: Category; name: string; sub: string; icon: string }[] = [
  {
    id: 'everyday',
    name: 'На каждый день',
    sub: 'Просьбы, планы и повседневные разговоры',
    icon: '☀',
  },
  { id: 'interview', name: 'Собеседование', sub: 'Опыт, навыки и вопросы работодателю', icon: '↗' },
  { id: 'work', name: 'На работе', sub: 'Задачи, обратная связь и общение с коллегами', icon: '▤' },
  { id: 'travel', name: 'В путешествии', sub: 'Транспорт, отель и новые города', icon: '✧' },
  {
    id: 'meetings',
    name: 'Созвоны и встречи',
    sub: 'Обсуждения, презентации и договорённости',
    icon: '◉',
  },
  {
    id: 'friends',
    name: 'Знакомство и общение',
    sub: 'Small talk, интересы и приглашения',
    icon: '☏',
  },
  { id: 'shopping', name: 'Магазин и кафе', sub: 'Заказ, оплата и покупки', icon: '◇' },
  { id: 'real', name: 'Живой английский', sub: 'Предложения и переводы из Tatoeba', icon: '◎' },
];

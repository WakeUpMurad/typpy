import { createServer } from 'node:http';
import { Communicate } from 'edge-tts-universal';

let active = 0;
const cache = new Map();
let cacheBytes = 0;
const maxCache = 32 * 1024 * 1024;
const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  if (req.method !== 'POST' || req.url !== '/synthesize') {
    res.writeHead(404).end();
    return;
  }
  try {
    let input = '';
    for await (const chunk of req) {
      input += chunk;
      if (Buffer.byteLength(input) > 8192) {
        res.writeHead(413).end();
        return;
      }
    }
    const { text, voice = 'en-US-JennyNeural', rate = '+0%' } = JSON.parse(input);
    if (
      typeof text !== 'string' ||
      !text.trim() ||
      Buffer.byteLength(text) > 5000 ||
      typeof rate !== 'string' ||
      !/^[+-]\d{1,3}%$/.test(rate) ||
      typeof voice !== 'string' ||
      !/^en-(US|GB)-[A-Za-z0-9]+Neural$/.test(voice)
    ) {
      res.writeHead(400).end();
      return;
    }
    const key = JSON.stringify([text, voice, rate]);
    const cached = cache.get(key);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' }).end(cached);
      return;
    }
    if (active >= 2) {
      res.writeHead(429, { 'Retry-After': '5' }).end();
      return;
    }
    active++;
    let audio;
    try {
      const chunks = [];
      let bytes = 0;
      const speech = new Communicate(text, { voice, rate, connectionTimeout: 10_000 });
      for await (const chunk of speech.stream()) {
        if (chunk.type !== 'audio' || !chunk.data) continue;
        bytes += chunk.data.length;
        if (bytes > 2 * 1024 * 1024) throw new Error('Oversized audio');
        chunks.push(chunk.data);
      }
      audio = Buffer.concat(chunks);
    } finally {
      active--;
    }
    if (!audio.length || audio.length > 2 * 1024 * 1024)
      throw new Error('Empty or oversized audio');
    if (cacheBytes + audio.length > maxCache) {
      cache.clear();
      cacheBytes = 0;
    }
    if (!cache.has(key)) {
      cache.set(key, audio);
      cacheBytes += audio.length;
    }
    if (!res.destroyed) res.writeHead(200, { 'Content-Type': 'audio/mpeg' }).end(audio);
  } catch (error) {
    console.error('Edge TTS:', error instanceof Error ? error.message : 'synthesis failed');
    if (!res.destroyed)
      res
        .writeHead(502, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Не удалось получить голос Edge TTS. Попробуй ещё раз' }));
  }
});
server.headersTimeout = 10_000;
server.requestTimeout = 20_000;
server.listen(3001, '127.0.0.1', () => console.log('Edge TTS готов (без ключа Azure)'));

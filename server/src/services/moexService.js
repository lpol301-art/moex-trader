// server/src/services/moexService.js

const axios = require('axios');

// Сколько максимум просим у MOEX за один запрос
const MOEX_LIMIT = 5000;

// Сколько максимум отдаём на фронт (чтобы не улететь в космос)
const MAX_CANDLES = 2000;

// Простейший in-memory кэш: ключ = symbol|tf, TTL ~ 60 секунд
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function mapTimeframeToInterval(tf) {
  // Значения interval по спецификации MOEX ISS для /candles
  // 1  - 1 минута
  // 10 - 10 минут
  // 60 - 1 час
  // 24 - 1 день
  switch (tf) {
    case '1h':
      return 60;
    case '10m':
      return 10;
    case '1d':
    default:
      return 24;
  }
}

function getFromDateParam() {
  const now = new Date();
  // Год назад от сегодняшней даты
  const fromDate = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate()
  );
  return fromDate.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Тянем свечи с MOEX ISS.
 * Возвращаем объект:
 * {
 *   symbol, timeframe, from, till, candlesCount, candles: [...]
 * }
 */
async function fetchCandlesFromMoex(symbol, timeframe) {
  const cacheKey = `${symbol}|${timeframe}`;
  const now = Date.now();

  // --- кэш ---
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const interval = mapTimeframeToInterval(timeframe);
  const from = getFromDateParam();

  // /candles.json работает и для 10m, и для 1h, и для 1d
  const url = `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${encodeURIComponent(
    symbol
  )}/candles.json?interval=${interval}&from=${from}&limit=${MOEX_LIMIT}`;

  console.log('[MOEX REQUEST]', url);

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'moex-viewer-demo'
    }
  });

  const data = response.data;
  const candlesBlock = data.candles;

  if (!candlesBlock || !candlesBlock.data || !candlesBlock.columns) {
    throw new Error('Unexpected MOEX response format (no candles block)');
  }

  const cols = candlesBlock.columns;
  const idxBegin = cols.indexOf('begin'); // дата/время
  const idxOpen = cols.indexOf('open');
  const idxHigh = cols.indexOf('high');
  const idxLow = cols.indexOf('low');
  const idxClose = cols.indexOf('close');
  const idxVolume = cols.indexOf('volume');

  if (
    idxBegin < 0 ||
    idxOpen < 0 ||
    idxHigh < 0 ||
    idxLow < 0 ||
    idxClose < 0 ||
    idxVolume < 0
  ) {
    throw new Error('MOEX candles: missing expected columns');
  }

  let candles = candlesBlock.data
    .map((row) => {
      const begin = row[idxBegin]; // "YYYY-MM-DD HH:MM:SS"
      const open = Number(row[idxOpen]);
      const high = Number(row[idxHigh]);
      const low = Number(row[idxLow]);
      const close = Number(row[idxClose]);
      const volume = Number(row[idxVolume]);

      if (
        !isFinite(open) ||
        !isFinite(high) ||
        !isFinite(low) ||
        !isFinite(close)
      ) {
        return null;
      }

      return {
        time: begin,
        open,
        high,
        low,
        close,
        volume
      };
    })
    .filter(Boolean);

  // режем с хвоста, если перебор по количеству
  if (candles.length > MAX_CANDLES) {
    candles = candles.slice(-MAX_CANDLES);
  }

  if (candles.length === 0) {
    throw new Error('MOEX returned empty candles');
  }

  const first = candles[0];
  const last = candles[candles.length - 1];

  const result = {
    symbol,
    timeframe,
    from: first.time,
    till: last.time,
    candlesCount: candles.length,
    candles
  };

  // кладём в кэш
  cache.set(cacheKey, {
    data: result,
    expiresAt: now + CACHE_TTL_MS
  });

  console.log(
    `[MOEX] ${symbol} tf=${timeframe} from=${result.from} -> ${result.candlesCount} candles`
  );

  return result;
}

module.exports = {
  fetchCandlesFromMoex
};

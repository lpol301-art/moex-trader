// server/src/services/moexService.js

const axios = require('axios');
const { readCache, writeCache } = require('../cache/jsonCache');

/**
 * Разрешённые таймфреймы и их соответствие интервалам MOEX ISS.
 * 10  = 10 минут
 * 60  = 1 час
 * 24  = 1 день
 */
const ALLOWED_TIMEFRAMES = {
  '10m': 10,
  '1h': 60,
  '1d': 24
};

/**
 * Максимум свечей, которые мы вернём клиенту.
 * (Чтобы не убить браузер огромным количеством данных.)
 */
const MAX_CANDLES = 2000;

/**
 * Лимит, который можно просить у MOEX за один запрос.
 */
const MOEX_MAX_LIMIT = 5000;

/**
 * Памятка: кеш в памяти процесса
 */
const CACHE_TTL_MS = 60 * 1000; // 60 секунд
const FILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут
const cache = new Map();

/**
 * Дата "по умолчанию" — 6 месяцев назад.
 * Если клиент не указал from, берём её.
 */
function getDefaultFromDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Ключ кеша.
 */
function buildCacheKey(symbol, timeframe, from, limit) {
  return `${symbol}|${timeframe}|${from || 'auto'}|${limit}`;
}

/**
 * Специальная ошибка для MOEX, чтобы контроллер мог отличить её
 * от обычных серверных ошибок.
 */
function createMoexError(message, meta) {
  const err = new Error(message);
  err.source = 'moex';
  if (meta) {
    err.meta = meta;
  }
  return err;
}

/**
 * Основная функция запроса свечей с MOEX ISS.
 *
 * @param {string} symbol     — тикер, например "SBER"
 * @param {string} timeframe  — '10m' | '1h' | '1d'
 * @param {object} options    — { limit?: number, from?: string }
 * @returns {Promise<Array<{time, open, high, low, close, volume}>>}
 */
async function fetchCandlesFromMoex(symbol, timeframe, options = {}) {
  const interval = ALLOWED_TIMEFRAMES[timeframe];
  if (!interval) {
    throw createMoexError(`Unsupported timeframe: ${timeframe}`, { timeframe });
  }

  const rawLimit = options.limit;
  let limit = 500;
  if (typeof rawLimit === 'number' && Number.isFinite(rawLimit)) {
    limit = Math.floor(rawLimit);
  }
  if (limit < 1) limit = 1;
  if (limit > MAX_CANDLES) limit = MAX_CANDLES;

  const from = options.from || getDefaultFromDate();
  const cacheKey = buildCacheKey(symbol, timeframe, from, limit);
  const cacheParams = {
    symbol,
    timeframe,
    from: from || 'auto',
    limit
  };

  // пробуем взять из кеша
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // Диск: читаем, если есть свежий кэш
  const diskCached = await readCache(cacheParams, FILE_CACHE_TTL_MS);
  if (diskCached && Array.isArray(diskCached.candles)) {
    cache.set(cacheKey, { data: diskCached.candles, expiresAt: now + CACHE_TTL_MS });
    return diskCached.candles;
  }

  // запрос к MOEX ISS
  const url = `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${encodeURIComponent(
    symbol
  )}/candles.json`;

  let response;
  try {
    response = await axios.get(url, {
      params: {
        interval,
        from,
        limit: Math.min(limit, MOEX_MAX_LIMIT)
      },
      timeout: 10000
    });
  } catch (err) {
    // HTTP-ошибка
    if (err.response) {
      throw createMoexError(
        `MOEX HTTP error: ${err.response.status}`,
        { status: err.response.status }
      );
    }

    // таймаут
    if (err.code === 'ECONNABORTED') {
      throw createMoexError(
        'Timeout while requesting MOEX ISS',
        { code: err.code }
      );
    }

    // любая другая сетевая ошибка
    throw createMoexError(
      'Network error while requesting MOEX ISS',
      { code: err.code }
    );
  }

  const payload = response && response.data;
  if (!payload || !payload.candles || !Array.isArray(payload.candles.data)) {
    throw createMoexError('Unexpected MOEX ISS response format');
  }

  const candlesBlock = payload.candles;
  const columns = candlesBlock.columns || [];
  const data = candlesBlock.data || [];

  const idxBegin = columns.indexOf('begin');
  const idxOpen = columns.indexOf('open');
  const idxHigh = columns.indexOf('high');
  const idxLow = columns.indexOf('low');
  const idxClose = columns.indexOf('close');
  const idxVolume = columns.indexOf('volume');

  if (
    idxBegin === -1 ||
    idxOpen === -1 ||
    idxHigh === -1 ||
    idxLow === -1 ||
    idxClose === -1 ||
    idxVolume === -1
  ) {
    throw createMoexError(
      'MOEX ISS candles: missing required columns',
      { columns }
    );
  }

  const candles = [];

  for (const row of data) {
    const timeStr = row[idxBegin];
    const open = Number(row[idxOpen]);
    const high = Number(row[idxHigh]);
    const low = Number(row[idxLow]);
    const close = Number(row[idxClose]);
    const volume = Number(row[idxVolume]);

    if (
      !timeStr ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      !Number.isFinite(volume)
    ) {
      continue;
    }

    candles.push({
      time: timeStr,
      open,
      high,
      low,
      close,
      volume
    });
  }

  // на всякий случай ещё раз обрежем по MAX_CANDLES
  const sliced = candles.slice(-MAX_CANDLES);

  // кладём в кеш
  cache.set(cacheKey, {
    data: sliced,
    expiresAt: now + CACHE_TTL_MS
  });

  // Пишем на диск для последующего использования между процессами/перезапусками
  await writeCache(cacheParams, sliced);

  return sliced;
}

module.exports = {
  fetchCandlesFromMoex,
  ALLOWED_TIMEFRAMES,
  MAX_CANDLES
};

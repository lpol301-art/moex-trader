// server/src/controllers/candleController.js

const {
  fetchCandlesFromMoex,
  ALLOWED_TIMEFRAMES,
  MAX_CANDLES
} = require('../services/moexService');

// допустимые ключи таймфреймов, например: ['10m', '1h', '1d']
const ALLOWED_TIMEFRAME_KEYS = Object.keys(ALLOWED_TIMEFRAMES);

/**
 * Универсальный ответ 400
 */
function respondBadRequest(res, details) {
  return res.status(400).json({
    error: 'bad_request',
    details
  });
}

/**
 * Нормализация тикера
 * - по умолчанию SBER
 * - только заглавные A-Z, длина 1–10
 */
function normalizeSymbol(raw) {
  const value = (raw || 'SBER').toUpperCase().trim();
  if (!value) return null;
  if (!/^[A-Z]{1,10}$/.test(value)) return null;
  return value;
}

/**
 * Нормализация таймфрейма
 * - по умолчанию '1d'
 * - только те, что есть в ALLOWED_TIMEFRAMES
 */
function normalizeTimeframe(raw) {
  const value = (raw || '1d').trim();
  if (!ALLOWED_TIMEFRAME_KEYS.includes(value)) {
    return null;
  }
  return value;
}

/**
 * Нормализация лимита
 * - если не задан, ставим 500
 * - число от 1 до MAX_CANDLES
 */
function normalizeLimit(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return 500;
  }

  const num = Number(raw);
  if (!Number.isFinite(num)) return null;

  const int = Math.floor(num);
  if (int < 1) return null;
  if (int > MAX_CANDLES) return MAX_CANDLES;

  return int;
}

/**
 * Нормализация даты from
 * - если пусто, возвращаем null (сервер сам поставит дефолт)
 * - если кривая дата — возвращаем null и сообщаем наружу, что был невалид
 */
function normalizeFromDate(raw) {
  if (!raw) {
    return { value: null, invalid: false };
  }

  const trimmed = String(raw).trim();
  if (!trimmed) {
    return { value: null, invalid: false };
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    // некорректная дата
    return { value: null, invalid: true };
  }

  // формат YYYY-MM-DD
  const iso = date.toISOString().slice(0, 10);
  return { value: iso, invalid: false };
}

/**
 * Основной контроллер: GET /api/candles
 * Параметры:
 *  - symbol: SBER (по умолчанию)
 *  - tf: один из ALLOWED_TIMEFRAMES, по умолчанию '1d'
 *  - limit: 1..MAX_CANDLES, по умолчанию 500
 *  - from: дата YYYY-MM-DD (опционально)
 */
async function getCandles(req, res) {
  try {
    // 1) тикер
    const symbol = normalizeSymbol(req.query.symbol);
    if (!symbol) {
      return respondBadRequest(
        res,
        'symbol: 1–10 заглавных латинских букв A-Z без пробелов (например, SBER)'
      );
    }

    // 2) таймфрейм
    const timeframe = normalizeTimeframe(req.query.tf);
    if (!timeframe) {
      return respondBadRequest(
        res,
        `tf: должен быть одним из [${ALLOWED_TIMEFRAME_KEYS.join(', ')}]`
      );
    }

    // 3) лимит
    const limit = normalizeLimit(req.query.limit);
    if (limit === null) {
      return respondBadRequest(
        res,
        `limit: целое число от 1 до ${MAX_CANDLES}`
      );
    }

    // 4) дата from
    const fromParsed = normalizeFromDate(req.query.from);
    if (fromParsed.invalid) {
      return respondBadRequest(
        res,
        'from: некорректная дата, ожидается формат YYYY-MM-DD (например, 2024-01-15)'
      );
    }
    const from = fromParsed.value; // либо строка, либо null

    // 5) запрос к MOEX (через сервис)
    const candles = await fetchCandlesFromMoex(symbol, timeframe, {
      limit,
      from
    });

    // 6) нормальный ответ
    return res.status(200).json({
      symbol,
      timeframe,
      limit,
      from: from || null,
      count: Array.isArray(candles) ? candles.length : 0,
      candles: candles || []
    });
  } catch (err) {
    console.error('[getCandles] error:', err);

    // ошибки, специально помеченные как moex-ошибки в сервисе
    if (err && err.source === 'moex') {
      return res.status(502).json({
        error: 'upstream_moex_error',
        details: err.message || 'Ошибка при обращении к MOEX ISS',
        meta: err.meta || null
      });
    }

    // остальные, неожиданные ошибки
    return res.status(500).json({
      error: 'server_error',
      details: err?.message || String(err)
    });
  }
}

module.exports = {
  getCandles
};

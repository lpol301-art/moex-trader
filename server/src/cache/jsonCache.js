// server/src/cache/jsonCache.js

const fs = require('fs');
const path = require('path');

// Папка, где будем хранить файлы кэша.
// __dirname здесь указывает на server/src/cache
const CACHE_DIR = __dirname;

// Убеждаемся, что папка существует
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Строим имя файла кэша по параметрам запроса.
 * Пример: SBER_1d_2024-01-01_limit-500.json
 */
function buildCacheFileName({ symbol, timeframe, from = 'auto', limit = 'max' }) {
  const rawName = `${symbol}_${timeframe}_${from}_limit-${limit}.json`;

  // На всякий случай вычищаем странные символы
  const safeName = rawName.replace(/[^a-zA-Z0-9_.-]/g, '_');

  return path.join(CACHE_DIR, safeName);
}

/**
 * Читает кэш из файла, если он существует и не устарел.
 *
 * @param {Object} params - ключ кэша (symbol, timeframe, from, limit)
 * @param {number} ttlMs  - время жизни кэша в миллисекундах
 */
async function readCache(params, ttlMs) {
  ensureCacheDir();

  const filePath = buildCacheFileName(params);

  if (!fs.existsSync(filePath)) {
    return null; // Кэша нет
  }

  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed.meta || !parsed.meta.createdAt) {
      // Формат странный — игнорируем кэш
      return null;
    }

    const createdAt = new Date(parsed.meta.createdAt).getTime();
    const now = Date.now();

    // Если кэш слишком старый — игнорируем
    if (now - createdAt > ttlMs) {
      console.log('[CACHE] Cache file is expired:', filePath);
      return null;
    }

    console.log('[CACHE] Cache hit:', filePath);

    return parsed; // вернём весь объект, внутри есть candles
  } catch (err) {
    console.error('[CACHE] Error reading cache file:', err.message);
    return null;
  }
}

/**
 * Записывает данные свечей в кэш.
 *
 * @param {Object} params - ключ кэша (symbol, timeframe, from, limit)
 * @param {Array} candles - массив свечей
 */
async function writeCache(params, candles) {
  ensureCacheDir();

  const filePath = buildCacheFileName(params);

  const payload = {
    meta: {
      createdAt: new Date().toISOString(),
      symbol: params.symbol,
      timeframe: params.timeframe,
      from: params.from,
      limit: params.limit
    },
    candles
  };

  try {
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log('[CACHE] Cache written:', filePath);
  } catch (err) {
    console.error('[CACHE] Error writing cache file:', err.message);
  }
}

module.exports = {
  readCache,
  writeCache
};

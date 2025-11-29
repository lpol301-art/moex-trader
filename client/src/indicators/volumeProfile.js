// client/src/indicators/volumeProfile.js

/**
 * Строит volume profile по свечам (OHLCV).
 *
 * ВАЖНО: это профиль по свечам, а не по тикам.
 * Позже можно будет передать сюда уже агрегированные тиковые данные.
 *
 * options:
 *  - mode: 'auto' | 'levels' | 'tick'
 *  - levels: число уровней профиля (для mode='levels')
 *  - tickSize: шаг цены в абсолютных единицах (для mode='tick')
 *
 * @param {Array} candles - массив свечей {open, high, low, close, volume}
 * @param {number} minPrice - минимальная цена по видимым свечам
 * @param {number} maxPrice - максимальная цена по видимым свечам
 * @param {Object} options
 *
 * @returns {{
 *   bins: { price: number, volume: number }[],
 *   priceStep: number,
 *   maxBinVolume: number,
 *   pocPrice: number | null,
 *   vahPrice: number | null,
 *   valPrice: number | null
 * }}
 */
export function buildVolumeProfileFromCandles(
  candles,
  minPrice,
  maxPrice,
  options = {}
) {
  if (!candles || candles.length === 0 || !isFinite(minPrice) || !isFinite(maxPrice)) {
    return {
      bins: [],
      priceStep: 1,
      maxBinVolume: 1,
      pocPrice: null,
      vahPrice: null,
      valPrice: null
    };
  }

  const mode = options.mode || 'auto'; // 'auto' | 'levels' | 'tick'
  const levels = options.levels || 0;
  const tickSize = options.tickSize || 0;

  // 1) Определяем priceStep
  let priceStep;

  if (mode === 'tick' && tickSize > 0) {
    priceStep = tickSize;
  } else if (mode === 'levels' && levels > 0 && maxPrice > minPrice) {
    priceStep = (maxPrice - minPrice) / levels;
  } else {
    // AUTO: оцениваем минимальный шаг цены по данным свечей
    const allPrices = [];
    candles.forEach((c) => {
      allPrices.push(c.open, c.high, c.low, c.close);
    });
    allPrices.sort((a, b) => a - b);

    let minDiff = Infinity;
    for (let i = 1; i < allPrices.length; i++) {
      const diff = allPrices[i] - allPrices[i - 1];
      if (diff > 0 && diff < minDiff) minDiff = diff;
    }

    if (!isFinite(minDiff) || minDiff <= 0) {
      // fallback — 100 уровней по диапазону
      priceStep = (maxPrice - minPrice) / 100 || 1;
    } else {
      priceStep = minDiff;
    }
  }

  if (!isFinite(priceStep) || priceStep <= 0) {
    priceStep = (maxPrice - minPrice) / 100 || 1;
  }

  // 2) Создаём бины по цене
  const bins = [];
  const startPrice = minPrice;
  const endPrice = maxPrice + priceStep * 0.5;

  for (let p = startPrice; p <= endPrice; p += priceStep) {
    bins.push({ price: p, volume: 0 });
  }

  // 3) Равномерно распределяем объём свечи по диапазону [low, high]
  candles.forEach((c) => {
    const low = c.low;
    const high = c.high;
    const vol = c.volume || 0;
    if (vol <= 0) return;

    const startIndex = Math.max(
      0,
      Math.floor((low - startPrice) / priceStep)
    );
    const endIndex = Math.min(
      bins.length - 1,
      Math.floor((high - startPrice) / priceStep)
    );
    const span = Math.max(1, endIndex - startIndex + 1);
    const perBin = vol / span;

    for (let i = startIndex; i <= endIndex; i++) {
      bins[i].volume += perBin;
    }
  });

  // 4) Ищем maxBinVolume, POC, VAH, VAL
  let maxBinVolume = 0;
  let pocIndex = -1;
  let totalVolume = 0;

  bins.forEach((b, idx) => {
    totalVolume += b.volume;
    if (b.volume > maxBinVolume) {
      maxBinVolume = b.volume;
      pocIndex = idx;
    }
  });

  if (maxBinVolume <= 0) maxBinVolume = 1;

  let pocPrice = null;
  let vahPrice = null;
  let valPrice = null;

  if (pocIndex >= 0 && totalVolume > 0) {
    pocPrice = bins[pocIndex].price;

    // Value Area = 70% объёма
    const targetVolume = totalVolume * 0.7;

    let lowIndex = pocIndex;
    let highIndex = pocIndex;
    let sumVolume = bins[pocIndex].volume;

    while (sumVolume < targetVolume && (lowIndex > 0 || highIndex < bins.length - 1)) {
      const nextLowIndex = lowIndex > 0 ? lowIndex - 1 : null;
      const nextHighIndex = highIndex < bins.length - 1 ? highIndex + 1 : null;

      let chooseIndex = null;

      if (nextLowIndex === null && nextHighIndex !== null) {
        chooseIndex = nextHighIndex;
      } else if (nextHighIndex === null && nextLowIndex !== null) {
        chooseIndex = nextLowIndex;
      } else if (nextLowIndex !== null && nextHighIndex !== null) {
        const lowVol = bins[nextLowIndex].volume;
        const highVol = bins[nextHighIndex].volume;
        // выбираем сторону с большим объёмом
        chooseIndex = lowVol >= highVol ? nextLowIndex : nextHighIndex;
      }

      if (chooseIndex === null) break;

      sumVolume += bins[chooseIndex].volume;
      if (chooseIndex < lowIndex) lowIndex = chooseIndex;
      if (chooseIndex > highIndex) highIndex = chooseIndex;
    }

    valPrice = bins[lowIndex].price;
    vahPrice = bins[highIndex].price;
  }

  return {
    bins,
    priceStep,
    maxBinVolume,
    pocPrice,
    vahPrice,
    valPrice
  };
}

// client/src/chart/geometry.js

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Окно видимых свечей: какие бары попали на экран
export function computeVisibleWindow(candles, barsPerScreen, rightOffset) {
  const total = candles ? candles.length : 0;
  if (total === 0) {
    return {
      visibleCandles: [],
      startIndex: 0,
      endIndex: 0,
      total: 0,
      bars: 0,
      offset: 0,
      maxOffset: 0
    };
  }

  const bars = clamp(
    Math.min(total, Math.max(20, Math.round(barsPerScreen || 20))),
    20,
    total
  );

  const maxOffset = Math.max(0, total - bars);
  const offsetClamped = clamp(rightOffset || 0, 0, maxOffset);

  const endIndex = total - offsetClamped;
  const startIndex = Math.max(0, endIndex - bars);

  const visibleCandles = candles.slice(startIndex, endIndex);

  return {
    visibleCandles,
    startIndex,
    endIndex,
    total,
    bars,
    offset: offsetClamped,
    maxOffset
  };
}

// Статистика по цене/объёму в видимом окне
export function computePriceStats(visibleCandles) {
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let maxVolume = 0;

  for (const c of visibleCandles) {
    if (!c) continue;
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    if (c.volume > maxVolume) maxVolume = c.volume;
  }

  if (!isFinite(minPrice) || !isFinite(maxPrice)) {
    minPrice = 0;
    maxPrice = 1;
  }

  if (minPrice === maxPrice) {
    minPrice -= 1;
    maxPrice += 1;
  }

  if (maxVolume <= 0) maxVolume = 1;

  return { minPrice, maxPrice, maxVolume };
}

// Геометрия чарта: размеры областей и функции перевода цена/объём/индекс → координаты
export function buildGeometry({
  width,
  height,
  visibleCount,
  minPrice,
  maxPrice,
  maxVolume,
  profileWidth
}) {
  const safeWidth = Math.max(400, width || 0);
  const safeHeight = Math.max(250, height || 0);

  const paddingTop = 16;
  const paddingBottom = 28;
  const paddingLeft = 48;

  // максимальная "теоретическая" ширина профиля (для настроек и будущих фич)
  const profileWidthClamped = clamp(Math.max(40, profileWidth || 80), 40, 200);

  // ширина ценовой шкалы
  const priceScaleWidth = 62;

  // небольшой отступ справа от шкалы до края канваса
  const rightPadding = 10;

  // правая граница шкалы (почти край канваса)
  const priceScaleRight = safeWidth - rightPadding;

  // X, где начинается ценовая шкала
  const priceScaleX = priceScaleRight - priceScaleWidth;

  // ВАЖНО: теперь окно графика (свечи) тянется прямо до ценовой шкалы
  const chartRight = priceScaleX;

  // ширина области свечей (от левого отступа до шкалы)
  const fullChartWidth = Math.max(100, chartRight - paddingLeft);

  const fullChartHeight = safeHeight - paddingTop - paddingBottom;

  const priceAreaRatio = 0.7;
  const priceChartHeight = fullChartHeight * priceAreaRatio;
  const volumeChartHeight = fullChartHeight * (1 - priceAreaRatio);

  const priceTop = paddingTop;
  const priceBottom = paddingTop + priceChartHeight;

  const volumeTop = priceBottom;
  const volumeBottom = paddingTop + fullChartHeight;

  const n = Math.max(1, visibleCount || 1);
  const candleSpacing = fullChartWidth / n;
  const candleWidth = Math.max(3, candleSpacing * 0.6);
  const volumeBarWidth = Math.max(2, candleSpacing * 0.5);

  function priceToY(price) {
    const t = (price - minPrice) / (maxPrice - minPrice || 1);
    return priceTop + (1 - t) * priceChartHeight;
  }

  function yToPrice(y) {
    let t = (y - priceTop) / (priceChartHeight || 1);
    t = clamp(t, 0, 1);
    return minPrice + (1 - t) * (maxPrice - minPrice);
  }

  function volumeToY(volume) {
    const t = volume / (maxVolume || 1);
    return volumeBottom - t * volumeChartHeight;
  }

  function indexToX(localIndex) {
    return (
      paddingLeft +
      localIndex * candleSpacing +
      candleSpacing / 2
    );
  }

  function xToLocalIndex(x) {
    const clampedX = clamp(x, paddingLeft, chartRight);
    const local = (clampedX - paddingLeft) / (candleSpacing || 1);
    return clamp(local, 0, n - 1);
  }

  return {
    layout: {
      width: safeWidth,
      height: safeHeight,
      paddingTop,
      paddingLeft,
      paddingBottom,
      chartRight,
      fullChartWidth,

      // "виртуальная" область профиля — теперь ВНУТРИ окна графика,
      // прижата к правому краю ценового окна
      profileLeft: Math.max(paddingLeft, chartRight - profileWidthClamped),
      profileRight: chartRight,

      // X начала ценовой шкалы (левый край шкалы)
      priceScaleX,
      priceTop,
      priceBottom,
      volumeTop,
      volumeBottom,
      priceChartHeight,
      volumeChartHeight,
      candleSpacing,
      candleWidth,
      volumeBarWidth,
      profileWidth: profileWidthClamped,
      priceScaleWidth
    },
    converters: {
      priceToY,
      yToPrice,
      volumeToY,
      indexToX,
      xToLocalIndex
    }
  };
}

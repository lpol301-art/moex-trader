// client/src/chart/renderRangeProfile.js
//
// Профиль по выделенному диапазону — ТОЛЬКО внутри прямоугольника выделения.

export function computeRangeProfile(
  candles,
  minPrice,
  maxPrice,
  enabledOrBins
) {
  if (!enabledOrBins) return null;
  if (!Array.isArray(candles) || candles.length === 0) return null;

  let min = Number.isFinite(minPrice) ? minPrice : Infinity;
  let max = Number.isFinite(maxPrice) ? maxPrice : -Infinity;

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return null;
  }

  let binsCount = 24;
  if (typeof enabledOrBins === 'number' && Number.isFinite(enabledOrBins)) {
    binsCount = Math.max(8, Math.floor(enabledOrBins));
  }

  const step = (max - min) / binsCount;
  if (!Number.isFinite(step) || step <= 0) return null;

  const bins = Array.from({ length: binsCount }, () => ({ volume: 0 }));

  for (const c of candles) {
    const mid = (c.open + c.close) / 2;
    const idx = Math.floor((mid - min) / step);
    const index = Math.max(0, Math.min(binsCount - 1, idx));
    const vol = Number(c.volume) || 0;
    bins[index].volume += vol;
  }

  const result = bins.map((b, i) => ({
    price: min + i * step,
    volume: b.volume
  }));

  // добавляем мета-информацию, чтобы правильно позиционировать бары по цене
  result.minPrice = min;
  result.maxPrice = max;
  result.priceStep = step;

  return result;
}

// Рисуем профиль ВНУТРИ прямоугольника, прижатым к его правой границе
export function renderRangeProfileInBox(
  ctx,
  rangeProfile,
  geometry,
  selectionBox,
  options = {}
) {
  if (!ctx || !rangeProfile || !geometry || !selectionBox) return;

  const bins = rangeProfile;
  if (!Array.isArray(bins) || bins.length === 0) return;

  const { x0, x1, y0, y1 } = selectionBox;
  const width = x1 - x0;
  if (!Number.isFinite(width) || width <= 0) return;

  const { priceToY } = geometry.converters || {};
  let maxVol = 0;
  for (const b of bins) if (b.volume > maxVol) maxVol = b.volume || 1;

  // Используем реальный ценовой шаг, чтобы привязать высоту полос к шкале
  const minPrice = Number(rangeProfile.minPrice);
  const explicitStep = Number(rangeProfile.priceStep);
  const fallbackStep =
    bins.length > 1 && Number.isFinite(bins[1].price - bins[0].price)
      ? bins[1].price - bins[0].price
      : null;
  const priceStep = Number.isFinite(explicitStep)
    ? explicitStep
    : fallbackStep;

  const color = options.profileColor || 'rgba(230, 183, 50, 0.85)';
  const innerRight = x1 - 2; // чуть-чуть отступаем от края

  ctx.save();

  bins.forEach((b, idx) => {
    const startPrice = Number.isFinite(minPrice)
      ? minPrice + idx * (priceStep || 0)
      : b.price;
    const endPrice = Number.isFinite(startPrice) && Number.isFinite(priceStep)
      ? startPrice + priceStep
      : startPrice;

    const yBottom = priceToY ? priceToY(startPrice) : y1;
    const yTop = priceToY && Number.isFinite(endPrice) ? priceToY(endPrice) : y0;

    const yBottomClamped = Math.min(y1, Math.max(y0, yBottom));
    const yTopClamped = Math.min(y1, Math.max(y0, yTop));

    const yCenter = Number.isFinite(yBottomClamped) && Number.isFinite(yTopClamped)
      ? (yBottomClamped + yTopClamped) / 2
      : y1 - ((y1 - y0) / bins.length) * (idx + 0.5);

    const barHeightRaw = Math.abs(yTopClamped - yBottomClamped) || (y1 - y0) / bins.length;
    const barHeight = Math.max(2, Math.min((y1 - y0) / bins.length, barHeightRaw * 0.95));

    const barW = (b.volume / maxVol) * width;
    const barWidthClamped = Math.max(0, Math.min(barW, width));
    const xEnd = innerRight;
    const xStart = Math.max(x0, xEnd - barWidthClamped);

    const yDraw = Math.min(y1 - barHeight / 2, Math.max(y0 + barHeight / 2, yCenter));
    ctx.fillStyle = color;
    ctx.fillRect(xStart, yDraw - barHeight / 2, barWidthClamped, barHeight);
  });

  ctx.restore();
}

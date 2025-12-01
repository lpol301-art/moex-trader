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

  return bins.map((b, i) => ({
    price: min + i * step,
    volume: b.volume
  }));
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
  const height = y1 - y0;
  if (!Number.isFinite(width) || width <= 0) return;
  if (!Number.isFinite(height) || height <= 0) return;

  let maxVol = 0;
  for (const b of bins) if (b.volume > maxVol) maxVol = b.volume || 1;

  const color = 'rgba(230, 183, 50, 0.85)'; // жёлто-оранжевый для диапазона
  const rowHeight = height / bins.length;
  const barHeight = Math.max(2, Math.min(6, rowHeight * 0.85));

  ctx.save();

  bins.forEach((b, idx) => {
    const y = y1 - rowHeight * (idx + 0.5);
    const barW = (b.volume / maxVol) * width;

    const barWidthClamped = Math.max(0, Math.min(barW, width));
    const xEnd = x1;
    const xStart = xEnd - barWidthClamped;

    ctx.fillStyle = color;
    ctx.fillRect(xStart, y - barHeight / 2, barWidthClamped, barHeight);
  });

  ctx.restore();
}

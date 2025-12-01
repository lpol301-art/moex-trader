// client/src/chart/renderRangeProfile.js
//
// Профиль по выделенному диапазону: строится только внутри выделения и
// распределяет объём по ценовым ступеням так, чтобы бары ложились в прямоугольник.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function computeRangeProfile(
  candles,
  minPrice,
  maxPrice,
  options = {}
) {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  const opts =
    typeof options === 'number'
      ? { bins: options }
      : options || {};

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

  const binsCount = clamp(Math.floor(opts.bins || 28), 8, 120);
  const step = (max - min) / binsCount;
  if (!Number.isFinite(step) || step <= 0) return null;

  const bins = Array.from({ length: binsCount }, () => ({ volume: 0 }));

  // распределение объёма по цене: 70% в тело свечи, 30% по хвостам
  const bodyShare = clamp(Number(opts.bodyShare) || 0.7, 0.4, 0.9);
  const epsilon = Math.max(step * 0.05, (max - min) * 1e-5);

  function distributeVolume(from, to, volume) {
    if (!Number.isFinite(volume) || volume <= 0) return;
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;

    const start = Math.max(min, Math.min(from, to));
    const end = Math.min(max, Math.max(from, to));

    // Если диапазон почти нулевой — считаем его тонкой полосой внутри ближайшего бинa
    if (end - start <= epsilon) {
      const idx = clamp(Math.floor((start - min) / step), 0, binsCount - 1);
      bins[idx].volume += volume;
      return;
    }

    const span = end - start;
    const firstBin = clamp(Math.floor((start - min) / step), 0, binsCount - 1);
    const lastBin = clamp(Math.floor((end - min) / step), 0, binsCount - 1);

    for (let i = firstBin; i <= lastBin; i += 1) {
      const binStart = min + i * step;
      const binEnd = binStart + step;
      const overlap = Math.min(end, binEnd) - Math.max(start, binStart);
      if (overlap > 0) {
        bins[i].volume += volume * (overlap / span);
      }
    }
  }

  for (const c of candles) {
    const volume = Number(c.volume) || 0;
    if (volume <= 0) continue;

    const low = Math.min(c.low, c.high);
    const high = Math.max(c.low, c.high);
    const bodyLow = Math.min(c.open, c.close);
    const bodyHigh = Math.max(c.open, c.close);

    const wickPortion = (1 - bodyShare) / 2;
    const bodyVolume = volume * bodyShare;
    const wickVolume = volume * wickPortion;

    distributeVolume(bodyLow, bodyHigh, bodyVolume);
    distributeVolume(low, Math.min(bodyLow, bodyHigh), wickVolume);
    distributeVolume(Math.max(bodyLow, bodyHigh), high, wickVolume);
  }

  const resultBins = bins.map((b, i) => ({
    price: min + i * step,
    volume: b.volume
  }));

  let maxVol = 0;
  let pocIndex = 0;
  let totalVolume = 0;
  resultBins.forEach((b, i) => {
    totalVolume += b.volume;
    if (b.volume > maxVol) {
      maxVol = b.volume;
      pocIndex = i;
    }
  });

  // Value Area 70% вокруг POC, чтобы красиво подсвечивать как в ATAS
  let vaLowPrice = null;
  let vaHighPrice = null;
  if (totalVolume > 0 && resultBins.length > 1) {
    const target = totalVolume * 0.7;
    let acc = maxVol;
    let left = pocIndex;
    let right = pocIndex;
    while (acc < target && (left > 0 || right < resultBins.length - 1)) {
      const nextLeft = left > 0 ? resultBins[left - 1].volume : 0;
      const nextRight = right < resultBins.length - 1 ? resultBins[right + 1].volume : 0;

      if (nextLeft >= nextRight) {
        if (left > 0) {
          left -= 1;
          acc += nextLeft;
        } else if (right < resultBins.length - 1) {
          right += 1;
          acc += nextRight;
        } else {
          break;
        }
      } else {
        if (right < resultBins.length - 1) {
          right += 1;
          acc += nextRight;
        } else if (left > 0) {
          left -= 1;
          acc += nextLeft;
        } else {
          break;
        }
      }
    }

    vaLowPrice = resultBins[left].price;
    vaHighPrice = resultBins[right].price + step;
  }

  return {
    bins: resultBins,
    minPrice: min,
    maxPrice: max,
    priceStep: step,
    maxVolume: maxVol || 1,
    pocIndex,
    totalVolume,
    vaLowPrice,
    vaHighPrice
  };
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

  const bins = Array.isArray(rangeProfile) ? rangeProfile : rangeProfile.bins;
  if (!Array.isArray(bins) || bins.length === 0) return;

  const meta = Array.isArray(rangeProfile)
    ? { minPrice: rangeProfile.minPrice, priceStep: rangeProfile.priceStep }
    : rangeProfile;

  const { x0, x1, y0, y1 } = selectionBox;
  const width = x1 - x0;
  const height = y1 - y0;
  if (!Number.isFinite(width) || width <= 0 || height <= 0) return;

  const { priceToY } = geometry.converters || {};
  const maxVol = meta.maxVolume || bins.reduce((acc, b) => Math.max(acc, b.volume), 1);

  const priceStep = Number(meta.priceStep) ||
    (bins.length > 1 && Number.isFinite(bins[1].price - bins[0].price)
      ? bins[1].price - bins[0].price
      : null);
  const minPrice = Number(meta.minPrice);

  const innerLeft = x0 + 8;
  const innerRight = x1 - 6;
  const barAreaWidth = Math.max(6, innerRight - innerLeft);

  const fillColor = options.fillColor || 'rgba(255, 255, 255, 0.05)';
  const baseColor = options.profileColor || 'rgba(230, 183, 50, 0.9)';
  const gradient = ctx.createLinearGradient(innerLeft, y0, innerRight, y0);
  gradient.addColorStop(0, baseColor.replace(/0\.\d+\)$/g, '0.35)'));
  gradient.addColorStop(1, baseColor);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, width, height);
  ctx.clip();

  // мягкая подложка как в ATAS
  ctx.fillStyle = fillColor;
  ctx.fillRect(x0, y0, width, height);

  const pocOverlayColor = options.pocColor || 'rgba(255, 255, 255, 0.85)';
  const vaColor = options.vaColor || fillColor;

  bins.forEach((b, idx) => {
    const startPrice = Number.isFinite(minPrice)
      ? minPrice + idx * (priceStep || 0)
      : b.price;
    const endPrice = Number.isFinite(startPrice) && Number.isFinite(priceStep)
      ? startPrice + priceStep
      : startPrice;

    const yStart = priceToY ? priceToY(startPrice) : y1;
    const yEnd = priceToY && Number.isFinite(endPrice) ? priceToY(endPrice) : y0;

    const yTop = clamp(Math.min(yStart, yEnd), y0, y1);
    const yBottom = clamp(Math.max(yStart, yEnd), y0, y1);

    const rawHeight = Math.max(2, yBottom - yTop);
    const gap = Math.min(2, rawHeight * 0.14);
    const barHeight = Math.max(2, rawHeight - gap);
    const yCenter = (yTop + yBottom) / 2;

    const widthShare = b.volume / (maxVol || 1);
    const barW = Math.max(0, barAreaWidth * widthShare);
    const xEnd = innerRight;
    const xStart = Math.max(innerLeft, xEnd - barW);

    // Value Area подсветка внутри прямоугольника
    if (
      Number.isFinite(meta.vaLowPrice) &&
      Number.isFinite(meta.vaHighPrice) &&
      startPrice >= meta.vaLowPrice &&
      startPrice < meta.vaHighPrice
    ) {
      ctx.fillStyle = vaColor;
      ctx.fillRect(x0, yTop, width, yBottom - yTop);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(xStart, yCenter - barHeight / 2, barW, barHeight);

    if (meta.pocIndex === idx) {
      ctx.fillStyle = pocOverlayColor;
      ctx.fillRect(xEnd - 2, yTop, 3, Math.max(3, yBottom - yTop));
    }
  });

  ctx.restore();
}

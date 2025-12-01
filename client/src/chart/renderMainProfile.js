// client/src/chart/renderMainProfile.js
//
// Основной объёмный профиль:
// - считается по видимым свечам
// - рисуется внутри области свечей, прижат к правому краю ценового окна
// - ОДИН цвет по всему профилю, плюс жёлтая линия POC

export function computeMainProfile(
  visibleCandles,
  minPrice,
  maxPrice,
  options = {}
) {
  if (!Array.isArray(visibleCandles) || visibleCandles.length === 0) {
    return null;
  }

  let min = Number.isFinite(minPrice) ? minPrice : Infinity;
  let max = Number.isFinite(maxPrice) ? maxPrice : -Infinity;

  // если min/max не пришли — считаем по свечам
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    for (const c of visibleCandles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return null;
  }

  const binsCount =
    options.bins && Number.isFinite(options.bins)
      ? Math.max(8, Math.floor(options.bins))
      : 32;

  const step = (max - min) / binsCount;
  if (!Number.isFinite(step) || step <= 0) return null;

  const bins = Array.from({ length: binsCount }, () => ({ volume: 0 }));

  // распределяем объём по "ступенькам" профиля
  for (const c of visibleCandles) {
    const mid = (c.open + c.close) / 2;
    const idx = Math.floor((mid - min) / step);
    const index = Math.max(0, Math.min(binsCount - 1, idx));
    const vol = Number(c.volume) || 0;
    bins[index].volume += vol;
  }

  const resultBins = bins.map((b, i) => ({
    price: min + i * step,
    volume: b.volume
  }));

  let maxVol = 0;
  let pocIndex = 0;
  resultBins.forEach((b, i) => {
    if (b.volume > maxVol) {
      maxVol = b.volume;
      pocIndex = i;
    }
  });

  if (maxVol <= 0) {
    return null;
  }

  return {
    bins: resultBins,
    pocIndex,
    maxVol
  };
}

export function renderMainProfile(ctx, mainProfile, geometry, options = {}) {
  if (!ctx || !mainProfile || !geometry) return;
  if (options.profileVisible === false) return;

  const layout = geometry.layout;
  const converters = geometry.converters;
  if (!layout || !converters) return;

  const { bins, pocIndex, maxVol } = mainProfile;
  if (!Array.isArray(bins) || bins.length === 0) return;

  const {
    paddingLeft,
    priceScaleX,
    priceTop,
    priceBottom
  } = layout;

  const priceHeight = priceBottom - priceTop;
  if (!Number.isFinite(priceHeight) || priceHeight <= 0) return;

  // ширина профиля внутри ценового окна (процент от ширины графика)
  const widthFactor = 0.26; // 26% ширины области свечей
  const priceWidth = priceScaleX - paddingLeft;
  const profileMaxWidth = priceWidth * widthFactor;
  if (!Number.isFinite(profileMaxWidth) || profileMaxWidth <= 0) return;

  const baseColor =
    options.profileColor || 'rgba(76, 111, 255, 0.55)'; // один цвет
  const pocColor = options.profilePocColor || '#F7D447';
  const barHeight = 8;

  ctx.save();

  // единый цвет по всему профилю
  bins.forEach((b, i) => {
    const t = i / bins.length;
    const y = priceTop + (1 - t) * priceHeight;
    const barW = (b.volume / maxVol) * profileMaxWidth;

    const barWidthClamped = Math.max(0, Math.min(barW, profileMaxWidth));
    const xEnd = priceScaleX;          // правая граница ценового окна
    const xStart = xEnd - barWidthClamped;

    ctx.fillStyle = baseColor;
    ctx.fillRect(xStart, y - barHeight / 2, barWidthClamped, barHeight);
  });

  // подчёркиваем POC отдельно:
  if (bins[pocIndex]) {
    const pocPrice = bins[pocIndex].price;
    const pocY = converters.priceToY(pocPrice);

    // линия POC по всей ширине ценового окна
    ctx.strokeStyle = pocColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, pocY + 0.5);
    ctx.lineTo(priceScaleX, pocY + 0.5);
    ctx.stroke();

    // и чуть более жирная ступенька на POC
    const pocVol = bins[pocIndex].volume;
    const pocBarW = (pocVol / maxVol) * profileMaxWidth;
    const pocBarWidth = Math.max(0, Math.min(pocBarW, profileMaxWidth));
    const xEnd = priceScaleX;
    const xStart = xEnd - pocBarWidth;

    ctx.fillStyle = pocColor;
    ctx.fillRect(xStart, pocY - barHeight / 2, pocBarWidth, barHeight);
  }

  ctx.restore();
}

// client/src/chart/renderVolumes.js

// Отрисовка гистограммы объёмов под графиком
export function renderVolumes(ctx, visibleCandles, geometry) {
  if (!ctx || !visibleCandles || visibleCandles.length === 0) return;

  const { layout, converters } = geometry;
  const { volumeBottom, volumeChartHeight, volumeBarWidth, paddingLeft, chartRight } =
    layout;
  const { volumeToY, indexToX } = converters;

  // Найдём максимальный объём в видимом окне
  let maxVolume = 0;
  for (const c of visibleCandles) {
    if (!c) continue;
    if (c.volume > maxVolume) maxVolume = c.volume;
  }
  if (maxVolume <= 0) maxVolume = 1;

  ctx.save();

  visibleCandles.forEach((candle, localIndex) => {
    if (!candle) return;
    const xCenter = indexToX(localIndex);

    const t = candle.volume / maxVolume;
    const yTop = volumeBottom - t * volumeChartHeight;
    const height = Math.max(1, volumeBottom - yTop);

    const isBull = candle.close >= candle.open;
    ctx.fillStyle = isBull ? '#3fd78a33' : '#ff4f5a33';

    ctx.fillRect(
      xCenter - volumeBarWidth / 2,
      yTop,
      volumeBarWidth,
      height
    );
  });

  ctx.restore();
}

// client/src/chart/renderCandles.js

// Отрисовка свечей: тело + хвосты
export function renderCandles(ctx, visibleCandles, geometry, globalStartIndex) {
  if (!ctx || !visibleCandles || visibleCandles.length === 0) return;

  const { layout, converters } = geometry;
  const { candleWidth } = layout;
  const { priceToY, indexToX } = converters;

  ctx.save();

  visibleCandles.forEach((candle, localIndex) => {
    if (!candle) return;

    const xCenter = indexToX(localIndex);

    const yOpen = priceToY(candle.open);
    const yClose = priceToY(candle.close);
    const yHigh = priceToY(candle.high);
    const yLow = priceToY(candle.low);

    const isBull = candle.close >= candle.open;

    const bodyColor = isBull ? '#3fd78a' : '#ff4f5a';
    const wickColor = '#cfd3dc22';

    // Хвост
    ctx.strokeStyle = wickColor;
    ctx.beginPath();
    ctx.moveTo(xCenter, yHigh);
    ctx.lineTo(xCenter, yLow);
    ctx.stroke();

    // Тело
    const bodyTop = Math.min(yOpen, yClose);
    const bodyBottom = Math.max(yOpen, yClose);
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

    ctx.fillStyle = bodyColor;
    ctx.fillRect(
      xCenter - candleWidth / 2,
      bodyTop,
      candleWidth,
      bodyHeight
    );
  });

  ctx.restore();
}

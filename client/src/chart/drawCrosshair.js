// client/src/chart/drawCrosshair.js

export function drawCrosshair(ctx, geometry, cursor, hoveredCandle) {
  if (!ctx || !cursor || !geometry) return;

  const { layout, converters } = geometry;
  const { priceScaleX, priceTop, priceBottom, paddingLeft, chartRight } = layout;
  const y = cursor.y;
  const x = cursor.x;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#ffffff25';

  // horizontal line
  ctx.beginPath();
  ctx.moveTo(paddingLeft, y);
  ctx.lineTo(chartRight, y);
  ctx.stroke();

  // vertical line
  ctx.beginPath();
  ctx.moveTo(x, priceTop);
  ctx.lineTo(x, priceBottom);
  ctx.stroke();

  // price label
  const price = converters.yToPrice(y);
  const txt = price.toFixed(2);
  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'middle';

  const labelX = priceScaleX + 4;
  const labelY = y;
  const w = ctx.measureText(txt).width + 8;
  const h = 16;

  ctx.fillStyle = '#1e1f23';
  ctx.fillRect(labelX, labelY - h / 2, w, h);

  ctx.fillStyle = '#d7dee9';
  ctx.fillText(txt, labelX + 4, labelY);

  // time label
  if (hoveredCandle) {
    const timeText = hoveredCandle.time.split('T')[0] || '';
    const tw = ctx.measureText(timeText).width + 8;
    const th = 16;
    const ty = priceBottom + 14;
    const tx = x - tw / 2;

    ctx.fillStyle = '#1e1f23';
    ctx.fillRect(tx, ty - th / 2, tw, th);
    ctx.fillStyle = '#d7dee9';
    ctx.fillText(timeText, tx + 4, ty);
  }

  ctx.restore();
}

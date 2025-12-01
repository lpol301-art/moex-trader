// client/src/chart/interactions.js

/**
 * Скролл (панорамирование) графика при зажатой ПКМ
 * deltaX — насколько сместили курсор
 * currentOffset — текущее смещение вправо (количество баров)
 * maxOffset — максимально возможное смещение
 */
export function calcPanOffset(deltaX, currentOffset, maxOffset, candleSpacing) {
  if (!candleSpacing) return currentOffset;
  const barsMoved = Math.round(deltaX / candleSpacing);
  let next = currentOffset + barsMoved;
  if (next < 0) next = 0;
  if (next > maxOffset) next = maxOffset;
  return next;
}

/**
 * Зум вокруг позиции курсора
 * bars — сколько баров на экране
 * mouseLocalIndex — локальный индекс бара под мышью
 */
export function calcZoomAroundPoint(bars, zoomDirection, minBars, maxBars) {
  const step = zoomDirection > 0 ? -5 : 5; // колесо вверх = увеличение = меньше баров
  let out = bars + step;
  if (out < minBars) out = minBars;
  if (out > maxBars) out = maxBars;
  return out;
}

/**
 * Определение глобального индекса свечи по X-координате курсора
 */
export function pickGlobalIndexFromX(x, geometry, startIndexGlobal, total) {
  const { converters } = geometry;
  const local = converters.xToLocalIndex(x);
  const round = Math.round(local);
  const global = startIndexGlobal + round;
  if (global < 0) return 0;
  if (global >= total) return total - 1;
  return global;
}

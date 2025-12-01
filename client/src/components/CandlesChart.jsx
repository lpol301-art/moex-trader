// client/src/components/CandlesChart.jsx

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildGeometry,
  computePriceStats,
  computeVisibleWindow
} from '../chart/geometry';
import { renderCandles } from '../chart/renderCandles';
import { renderVolumes } from '../chart/renderVolumes';
import {
  computeMainProfile,
  renderMainProfile
} from '../chart/renderMainProfile';
import {
  computeRangeProfile,
  renderRangeProfileInBox
} from '../chart/renderRangeProfile';
import { drawCrosshair } from '../chart/drawCrosshair';
import {
  calcPanOffset,
  calcZoomAroundPoint,
  pickGlobalIndexFromX
} from '../chart/interactions';

function CandlesChart({
  candles,
  profileStepMode,      // пока не используем, просто пробрасываем
  profileVisible,
  profileColor,
  profilePocColor,
  profileVaOpacity,
  profileWidth,
  rangeProfileEnabled    // чекбокс "Range проф."
}) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [barsPerScreen, setBarsPerScreen] = useState(140);
  const [rightOffset, setRightOffset] = useState(0);
  const [selectionRange, setSelectionRange] = useState(null);
  const [crosshair, setCrosshair] = useState({ visible: false, x: 0, y: 0 });

  const dragRef = useRef({
    type: null, // 'pan' | 'select' | 'cross'
    startX: 0,
    startOffset: 0,
    startIndex: null
  });

  // размер контейнера
  useEffect(() => {
    function updateSize() {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height)
      });
    }

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // окно видимых свечей
  const visibleWindow = useMemo(
    () => computeVisibleWindow(candles || [], barsPerScreen, rightOffset),
    [candles, barsPerScreen, rightOffset]
  );

  // статистика по цене/объёму
  const priceStats = useMemo(
    () => computePriceStats(visibleWindow.visibleCandles),
    [visibleWindow.visibleCandles]
  );

  // геометрия
  const geometry = useMemo(() => {
    if (!size.width || !size.height) return null;

    return buildGeometry({
      width: size.width,
      height: size.height,
      visibleCount: Math.max(visibleWindow.visibleCandles.length, 1),
      minPrice: priceStats.minPrice,
      maxPrice: priceStats.maxPrice,
      maxVolume: priceStats.maxVolume,
      profileWidth // пока не используется напрямую для отрисовки, но пусть остаётся
    });
  }, [
    size.width,
    size.height,
    visibleWindow.visibleCandles.length,
    priceStats.minPrice,
    priceStats.maxPrice,
    priceStats.maxVolume,
    profileWidth
  ]);

  // основной профиль
  const mainProfile = useMemo(() => {
    if (!geometry) return null;

    return computeMainProfile(
      visibleWindow.visibleCandles,
      priceStats.minPrice,
      priceStats.maxPrice,
      {
        bins: 32
      }
    );
  }, [
    geometry,
    visibleWindow.visibleCandles,
    priceStats.minPrice,
    priceStats.maxPrice
  ]);

  // свечи в диапазоне
  const rangeCandles = useMemo(() => {
    if (!selectionRange || !candles || !candles.length) return [];
    const start = Math.max(0, Math.min(selectionRange.start, selectionRange.end));
    const end = Math.min(
      candles.length,
      Math.max(selectionRange.start, selectionRange.end) + 1
    );
    return candles.slice(start, end);
  }, [selectionRange, candles]);

  // профиль диапазона
  const rangeProfile = useMemo(() => {
    if (!geometry || !rangeCandles.length) return null;

    return computeRangeProfile(
      rangeCandles,
      priceStats.minPrice,
      priceStats.maxPrice,
      rangeProfileEnabled ? 24 : false
    );
  }, [
    geometry,
    rangeCandles,
    priceStats.minPrice,
    priceStats.maxPrice,
    rangeProfileEnabled
  ]);

  // прямоугольник выделения
  const selectionBox = useMemo(() => {
    if (!geometry || !selectionRange || visibleWindow.visibleCandles.length === 0)
      return null;

    const { converters, layout } = geometry;
    const startGlobal = Math.max(
      0,
      Math.min(selectionRange.start, selectionRange.end)
    );
    const endGlobal = Math.max(selectionRange.start, selectionRange.end);

    if (
      endGlobal < visibleWindow.startIndex ||
      startGlobal > visibleWindow.endIndex
    ) {
      return null;
    }

    const startLocal = Math.max(startGlobal - visibleWindow.startIndex, 0);
    const endLocal = Math.min(
      endGlobal - visibleWindow.startIndex,
      visibleWindow.bars - 1
    );

    const x0 = converters.indexToX(startLocal) - layout.candleWidth / 2;
    const x1 = converters.indexToX(endLocal) + layout.candleWidth / 2;

    return {
      x0,
      x1,
      y0: layout.priceTop,
      y1: layout.priceBottom,
      startLocal,
      endLocal
    };
  }, [geometry, selectionRange, visibleWindow]);

  // отрисовка
  useEffect(() => {
    if (!canvasRef.current || !geometry || visibleWindow.visibleCandles.length === 0)
      return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const width = size.width || canvas.clientWidth || 0;
    const height = size.height || canvas.clientHeight || 0;
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;

    // фон
    ctx.fillStyle = '#111317';
    ctx.fillRect(0, 0, width, height);

    // сетка
    drawGrid(ctx, geometry, priceStats, visibleWindow.visibleCandles);

    // свечи + объёмы
    renderCandles(
      ctx,
      visibleWindow.visibleCandles,
      geometry,
      visibleWindow.startIndex
    );
    renderVolumes(ctx, visibleWindow.visibleCandles, geometry);

    // основной профиль (только ВНУТРИ окна графика, поверх свечей)
    if (mainProfile) {
      renderMainProfile(ctx, mainProfile, geometry, {
        profileColor,
        profilePocColor,
        profileVaOpacity,
        profileVisible
      });
    }

    // профиль диапазона — ТОЛЬКО внутри прямоугольника
    if (rangeProfileEnabled && selectionBox && rangeProfile) {
      renderRangeProfileInBox(ctx, rangeProfile, geometry, selectionBox, {
        profileColor: profileColor || '#e6b73288'
      });
    }

    // шкалы
    drawScales(ctx, geometry, priceStats);

    // кроссхэйр
    let hoveredCandle = null;
    if (crosshair.visible && candles && candles.length) {
      const globalIndex = pickGlobalIndexFromX(
        crosshair.x,
        geometry,
        visibleWindow.startIndex,
        visibleWindow.total
      );
      if (globalIndex >= 0 && globalIndex < candles.length) {
        hoveredCandle = candles[globalIndex];
      }
    }

    drawCrosshair(
      ctx,
      geometry,
      crosshair.visible ? crosshair : null,
      hoveredCandle
    );
  }, [
    geometry,
    size.width,
    size.height,
    priceStats,
    visibleWindow,
    mainProfile,
    selectionBox,
    rangeProfile,
    profileColor,
    profilePocColor,
    profileVaOpacity,
    profileVisible,
    crosshair,
    candles,
    rangeProfileEnabled
  ]);

  // мышь

  function handleWheel(e) {
    e.preventDefault();
    if (!geometry) return;

    const maxBars = candles && candles.length ? candles.length : 20;
    const nextBars = calcZoomAroundPoint(barsPerScreen, e.deltaY, 20, maxBars);
    setBarsPerScreen(nextBars);
  }

  function handleMouseDown(e) {
    if (!geometry) return;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    // средняя кнопка — кроссхэйр
    if (e.button === 1) {
      setCrosshair({ visible: true, x, y });
      dragRef.current = {
        type: 'cross',
        startX: x,
        startOffset: rightOffset,
        startIndex: null
      };
      return;
    }

    // правая — панорамирование
    if (e.button === 2) {
      dragRef.current = {
        type: 'pan',
        startX: x,
        startOffset: rightOffset,
        startIndex: null
      };
      return;
    }

    // левая — выделение
    if (e.button === 0) {
      const startIndex = pickGlobalIndexFromX(
        x,
        geometry,
        visibleWindow.startIndex,
        visibleWindow.total
      );
      setSelectionRange({ start: startIndex, end: startIndex });
      dragRef.current = {
        type: 'select',
        startX: x,
        startOffset: rightOffset,
        startIndex
      };
    }
  }

  function handleMouseMove(e) {
    if (!geometry) return;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    const drag = dragRef.current;

    if (drag.type === 'pan') {
      const deltaX = x - drag.startX;
      const candleSpacing = geometry.layout.candleSpacing;
      const maxOffset = visibleWindow.maxOffset;
      const nextOffset = calcPanOffset(
        deltaX,
        drag.startOffset,
        maxOffset,
        candleSpacing
      );
      setRightOffset(nextOffset);
      return;
    }

    if (drag.type === 'select' && drag.startIndex !== null) {
      const idx = pickGlobalIndexFromX(
        x,
        geometry,
        visibleWindow.startIndex,
        visibleWindow.total
      );
      setSelectionRange({ start: drag.startIndex, end: idx });
      return;
    }

    if (drag.type === 'cross') {
      setCrosshair({ visible: true, x, y });
      return;
    }
  }

  function handleMouseUp() {
    if (dragRef.current.type === 'cross') {
      setCrosshair((prev) => ({ ...prev, visible: false }));
    }
    dragRef.current = {
      type: null,
      startX: 0,
      startOffset: 0,
      startIndex: null
    };
  }

  function handleLeave() {
    if (dragRef.current.type === 'cross') {
      setCrosshair((prev) => ({ ...prev, visible: false }));
    }
    dragRef.current = {
      type: null,
      startX: 0,
      startOffset: 0,
      startIndex: null
    };
  }

  function handleContextMenu(e) {
    e.preventDefault();
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#111317'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: 'default' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleLeave}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}

// сетка
function drawGrid(ctx, geometry, priceStats, visibleCandles) {
  const { layout, converters } = geometry;
  const {
    priceTop,
    priceBottom,
    chartRight,
    paddingLeft,
    priceScaleX
  } = layout;

  ctx.strokeStyle = '#1f242e';
  ctx.lineWidth = 1;

  const lines = 6;
  for (let i = 0; i <= lines; i++) {
    const t = i / lines;
    const price =
      priceStats.minPrice + t * (priceStats.maxPrice - priceStats.minPrice);
    const y = converters.priceToY(price);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(priceScaleX, y);
    ctx.stroke();
  }

  const bars = visibleCandles.length;
  const step = Math.max(1, Math.floor(bars / 8));
  for (let i = 0; i < bars; i += step) {
    const x = converters.indexToX(i);
    ctx.beginPath();
    ctx.moveTo(x, priceTop);
    ctx.lineTo(x, priceBottom);
    ctx.stroke();
  }

  // граница между графиком и шкалой
  ctx.beginPath();
  ctx.moveTo(priceScaleX + 0.5, priceTop);
  ctx.lineTo(priceScaleX + 0.5, priceBottom);
  ctx.stroke();

  // правая рамка (до края канваса / списка инструментов)
  ctx.beginPath();
  ctx.moveTo(chartRight + 0.5, priceTop);
  ctx.lineTo(chartRight + 0.5, priceBottom);
  ctx.stroke();
}

// шкалы
function drawScales(ctx, geometry, priceStats) {
  const { layout, converters } = geometry;
  const {
    priceScaleX,
    priceTop,
    priceBottom,
    paddingLeft,
    chartRight
  } = layout;

  ctx.save();
  ctx.fillStyle = '#111317';
  ctx.fillRect(
    priceScaleX,
    priceTop,
    chartRight - priceScaleX,
    priceBottom - priceTop
  );

  ctx.fillStyle = '#d7dee9';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const lines = 6;
  for (let i = 0; i <= lines; i++) {
    const t = i / lines;
    const price =
      priceStats.minPrice + t * (priceStats.maxPrice - priceStats.minPrice);
    const y = converters.priceToY(price);
    const text = price.toFixed(2);
    ctx.fillText(text, priceScaleX + 4, y);
  }

  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#111317';
  ctx.fillRect(paddingLeft, priceBottom, chartRight - paddingLeft, 20);
  ctx.restore();
}

export default CandlesChart;

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
  profileStepMode,
  profileVisible,
  profileColor,
  profilePocColor,
  profileVaOpacity,
  profileWidth,
  profileShowPoc,
  rangeProfileEnabled,
  rangePinRequestId
}) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [barsPerScreen, setBarsPerScreen] = useState(140);
  const [rightOffset, setRightOffset] = useState(0);

  // текущее живое выделение
  const [selectionRange, setSelectionRange] = useState(null);
  // закреплённые диапазоны (по индексам свечей)
  const [fixedRanges, setFixedRanges] = useState([]);

  const [crosshair, setCrosshair] = useState({ visible: false, x: 0, y: 0 });

  const dragRef = useRef({
    type: null,
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
      profileWidth
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

    const count = visibleWindow.visibleCandles.length;
    if (!count) return null;

    let bins;
    if (profileStepMode === 'auto') {
      const approx = Math.floor(count / 3);
      bins = Math.min(120, Math.max(16, approx || 16));
    } else {
      const parsed = parseInt(profileStepMode, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        bins = Math.min(200, Math.max(8, parsed));
      } else {
        bins = 32;
      }
    }

    return computeMainProfile(
      visibleWindow.visibleCandles,
      priceStats.minPrice,
      priceStats.maxPrice,
      { bins }
    );
  }, [
    geometry,
    visibleWindow.visibleCandles,
    priceStats.minPrice,
    priceStats.maxPrice,
    profileStepMode
  ]);

  // свечи в текущем диапазоне
  const rangeCandles = useMemo(() => {
    if (!selectionRange || !candles || !candles.length) return [];
    const start = Math.max(0, Math.min(selectionRange.start, selectionRange.end));
    const end = Math.min(
      candles.length,
      Math.max(selectionRange.start, selectionRange.end) + 1
    );
    return candles.slice(start, end);
  }, [selectionRange, candles]);

  // профиль текущего диапазона
  const rangeProfile = useMemo(() => {
    if (!geometry || !rangeCandles.length || !rangeProfileEnabled) return null;
    return computeRangeProfile(
      rangeCandles,
      priceStats.minPrice,
      priceStats.maxPrice,
      24
    );
  }, [
    geometry,
    rangeCandles,
    priceStats.minPrice,
    priceStats.maxPrice,
    rangeProfileEnabled
  ]);

  // прямоугольник текущего выделения в координатах canvas (x0/x1/y0/y1!)
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

    const x0 = converters.indexToX(startLocal) - geometry.layout.candleWidth / 2;
    const x1 = converters.indexToX(endLocal) + geometry.layout.candleWidth / 2;

    return {
      x0,
      x1,
      y0: geometry.layout.priceTop,
      y1: geometry.layout.priceBottom
    };
  }, [geometry, selectionRange, visibleWindow]);

  // при нажатии "Закрепить" добавляем текущий диапазон в fixedRanges
  useEffect(() => {
    if (!rangePinRequestId) return;
    if (!selectionRange || !candles || !candles.length) return;

    const start = Math.max(
      0,
      Math.min(selectionRange.start, selectionRange.end)
    );
    const end = Math.min(
      candles.length - 1,
      Math.max(selectionRange.start, selectionRange.end)
    );
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      return;
    }

    setFixedRanges((prev) => [
      ...prev,
      { id: `${rangePinRequestId}-${Date.now()}`, start, end }
    ]);
  }, [rangePinRequestId, selectionRange, candles]);

  // считаем профили и прямоугольники для закреплённых диапазонов
  const fixedProfiles = useMemo(() => {
    if (!geometry || !candles || !candles.length || !fixedRanges.length) return [];

    const { converters, layout } = geometry;

    return fixedRanges
      .map((range) => {
        const startGlobal = Math.max(0, Math.min(range.start, range.end));
        const endGlobal = Math.min(
          candles.length - 1,
          Math.max(range.start, range.end)
        );
        if (startGlobal >= endGlobal) return null;

        // полностью вне экрана — не рисуем
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

        const box = {
          x0,
          x1,
          y0: layout.priceTop,
          y1: layout.priceBottom
        };

        const sliceStart = Math.max(0, startGlobal);
        const sliceEnd = Math.min(candles.length, endGlobal + 1);
        const candlesSlice = candles.slice(sliceStart, sliceEnd);

        const profile = computeRangeProfile(
          candlesSlice,
          priceStats.minPrice,
          priceStats.maxPrice,
          24
        );
        if (!profile) return null;

        return { id: range.id, box, profile };
      })
      .filter(Boolean);
  }, [
    geometry,
    candles,
    fixedRanges,
    priceStats.minPrice,
    priceStats.maxPrice,
    visibleWindow
  ]);

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

    // основной профиль
    if (mainProfile) {
      renderMainProfile(ctx, mainProfile, geometry, {
        profileColor,
        profilePocColor,
        profileVaOpacity,
        profileVisible,
        profileWidth,
        showPoc: profileShowPoc
      });
    }

    // закреплённые Range-профили (синие)
    fixedProfiles.forEach(({ box, profile }) => {
      ctx.save();
      ctx.fillStyle = 'rgba(37, 99, 235, 0.10)';
      ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      ctx.restore();

      renderRangeProfileInBox(ctx, profile, geometry, box, {
        profileColor: 'rgba(59, 130, 246, 0.85)'
      });
    });

    // активный Range-профиль (зелёный)
    if (rangeProfileEnabled && selectionBox && rangeProfile) {
      ctx.save();
      ctx.fillStyle = 'rgba(22, 163, 74, 0.10)';
      ctx.fillRect(
        selectionBox.x0,
        selectionBox.y0,
        selectionBox.x1 - selectionBox.x0,
        selectionBox.y1 - selectionBox.y0
      );
      ctx.restore();

      renderRangeProfileInBox(ctx, rangeProfile, geometry, selectionBox, {
        profileColor: profileColor || '#16a34a'
      });
    }

    // шкалы
    drawScales(ctx, geometry, priceStats, visibleWindow.visibleCandles);

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
    profileWidth,
    profileShowPoc,
    crosshair,
    candles,
    rangeProfileEnabled,
    fixedProfiles
  ]);

  // зум колесом
  function handleWheel(e) {
    e.preventDefault();
    if (!geometry) return;

    const maxBars = candles && candles.length ? candles.length : 20;
    const nextBars = calcZoomAroundPoint(barsPerScreen, e.deltaY, 20, maxBars);
    setBarsPerScreen(nextBars);
  }

  // нажатие кнопки мыши
  function handleMouseDown(e) {
    if (!geometry) return;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

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

    if (e.button === 2) {
      dragRef.current = {
        type: 'pan',
        startX: x,
        startOffset: rightOffset,
        startIndex: null
      };
      return;
    }

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
      return;
    }
  }

  // движение мыши
  function handleMouseMove(e) {
    if (!geometry) return;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    const drag = dragRef.current;
    if (!drag.type) {
      setCrosshair({ visible: true, x, y });
      return;
    }

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

    if (drag.type === 'select') {
      const currentIndex = pickGlobalIndexFromX(
        x,
        geometry,
        visibleWindow.startIndex,
        visibleWindow.total
      );
      setSelectionRange({
        start: drag.startIndex,
        end: currentIndex
      });
      setCrosshair({ visible: true, x, y });
      return;
    }

    if (drag.type === 'cross') {
      setCrosshair({ visible: true, x, y });
      return;
    }
  }

  // отпускание кнопки
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

  // уход мыши с холста
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

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#020617'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

// сетка
function drawGrid(ctx, geometry, priceStats, visibleCandles) {
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
    paddingLeft,
    priceTop,
    chartRight - paddingLeft,
    priceBottom - priceTop
  );

  ctx.strokeStyle = '#1f2933';
  ctx.lineWidth = 1;

  const bars = visibleCandles.length;
  const step = Math.max(1, Math.floor(bars / 8));
  for (let i = 0; i < bars; i += step) {
    const x = converters.indexToX(i);
    ctx.beginPath();
    ctx.moveTo(x, priceTop);
    ctx.lineTo(x, priceBottom);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(priceScaleX + 0.5, priceTop);
  ctx.lineTo(priceScaleX + 0.5, priceBottom);
  ctx.stroke();

  ctx.restore();
}

// шкалы
function drawScales(ctx, geometry, priceStats, visibleCandles) {
  const { layout } = geometry;
  const { priceScaleX, priceTop, priceBottom, chartRight } = layout;

  ctx.save();
  ctx.fillStyle = '#020617';
  ctx.fillRect(
    priceScaleX,
    priceTop,
    chartRight - priceScaleX,
    priceBottom - priceTop
  );
  ctx.restore();
}

export default CandlesChart;

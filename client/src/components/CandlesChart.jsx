// client/src/components/CandlesChart.jsx

import { useEffect, useRef, useState } from 'react';
import { buildVolumeProfileFromCandles } from '../indicators/volumeProfile';

/**
 * Свечной график:
 * - свечи + объёмы
 * - шкалы справа
 * - зум колесом (по времени)
 * - перекрестие (средняя кнопка)
 * - основной профиль справа (POC/VAH/VAL, настраиваемый)
 * - range-профиль по выделенному диапазону:
 *   * выделение ЛКМ по барам
 *   * прямоугольник масштабируется вместе с графиком
 *   * профиль рисуется справа от выделения
 * - панорамирование графика по времени ПКМ (влево/вправо)
 *
 * props:
 *  - candles
 *  - profileStepMode
 *  - profileVisible
 *  - profileColor
 *  - profilePocColor
 *  - profileVaOpacity
 *  - profileWidth
 *  - rangeProfileEnabled
 */
function CandlesChart({
  candles,
  profileStepMode,
  profileVisible,
  profileColor,
  profilePocColor,
  profileVaOpacity,
  profileWidth,
  rangeProfileEnabled
}) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);

  const [size, setSize] = useState({ width: 0, height: 0 });

  const [crossVisible, setCrossVisible] = useState(false);
  const [crossPos, setCrossPos] = useState({ x: 0, y: 0 });
  const [middleDown, setMiddleDown] = useState(false);

  // зум: сколько баров на экране
  const [barsPerScreen, setBarsPerScreen] = useState(120);

  // панорамирование по времени (смещение окна от правого края в барах)
  const [rightOffset, setRightOffset] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);

  // range-выделение: индексы баров внутри видимого окна
  const [selectionRange, setSelectionRange] = useState(null); // { startIndex, endIndex }
  const [dragSelecting, setDragSelecting] = useState(false);

  // для обработчиков мыши нужно знать геометрию чарта
  const chartParamsRef = useRef({
    paddingLeft: 0,
    chartRight: 0,
    fullChartWidth: 0,
    n: 0
  });

  // Подгоняем размер canvas под контейнер
  useEffect(() => {
    function updateSize() {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setSize({
        width: Math.max(400, Math.floor(rect.width)),
        height: Math.max(250, Math.floor(rect.height))
      });
    }

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Когда меняется набор свечей — сбрасываем панорамирование и выделение
  useEffect(() => {
    setRightOffset(0);
    setSelectionRange(null);
  }, [candles]);

  // Держим rightOffset в допустимых пределах при изменении зума/кол-ва свечей
  useEffect(() => {
    if (!candles || candles.length === 0) return;
    const total = candles.length;
    const bars = Math.min(total, Math.max(20, barsPerScreen));
    const maxOffset = Math.max(0, total - bars);
    setRightOffset((prev) => Math.min(prev, maxOffset));
  }, [candles, barsPerScreen]);

  // Основная отрисовка
  useEffect(() => {
    if (!canvasRef.current || !candles || candles.length === 0) return;
    if (!size.width || !size.height) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = size.width);
    const height = (canvas.height = size.height);

    // фон
    ctx.fillStyle = '#111317';
    ctx.fillRect(0, 0, width, height);

    const total = candles.length;
    const bars = Math.min(total, Math.max(20, barsPerScreen));
    const maxOffset = Math.max(0, total - bars);
    const offset = Math.min(rightOffset, maxOffset);

    // видимое окно по глобальному массиву
    const endIndexGlobal = total - offset;
    const startIndexGlobal = Math.max(0, endIndexGlobal - bars);
    const visibleCandles = candles.slice(startIndexGlobal, endIndexGlobal);
    const n = visibleCandles.length;
    if (n === 0) return;

    // min/max цены и max объём
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;
    visibleCandles.forEach((c) => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVolume) maxVolume = c.volume;
    });
    if (minPrice === maxPrice) {
      minPrice -= 1;
      maxPrice += 1;
    }
    if (maxVolume === 0) maxVolume = 1;

    // геометрия
    const paddingTop = 16;
    const paddingBottom = 28;
    const paddingLeft = 40;

    const PROFILE_WIDTH_CLAMPED = Math.max(
      40,
      Math.min(160, profileWidth || 80)
    );
    const PRICE_SCALE_WIDTH = 60;

    const rightTotal = PRICE_SCALE_WIDTH + PROFILE_WIDTH_CLAMPED + 10;
    const chartRight = width - rightTotal;
    const fullChartWidth = chartRight - paddingLeft;

    const profileLeft = chartRight + 4;
    const profileRight = profileLeft + PROFILE_WIDTH_CLAMPED - 8;
    const priceScaleX = profileRight + 6;

    const fullChartHeight = height - paddingTop - paddingBottom;

    const priceAreaRatio = 0.7;
    const priceChartHeight = fullChartHeight * priceAreaRatio;
    const volumeChartHeight = fullChartHeight * (1 - priceAreaRatio);

    const priceTop = paddingTop;
    const priceBottom = paddingTop + priceChartHeight;

    const volumeTop = priceBottom;
    const volumeBottom = paddingTop + fullChartHeight;

    const candleSpacing = fullChartWidth / n;
    const candleWidth = Math.max(3, candleSpacing * 0.6);
    const volumeBarWidth = Math.max(2, candleSpacing * 0.5);

    // сохраняем геометрию для обработчиков мыши
    chartParamsRef.current = {
      paddingLeft,
      chartRight,
      fullChartWidth,
      n
    };

    function priceToY(price) {
      const t = (price - minPrice) / (maxPrice - minPrice);
      return priceTop + (1 - t) * priceChartHeight;
    }

    function yToPrice(y) {
      let t = (y - priceTop) / priceChartHeight;
      t = Math.min(1, Math.max(0, t));
      return minPrice + (1 - t) * (maxPrice - minPrice);
    }

    function volumeToY(volume) {
      const t = volume / maxVolume;
      return volumeBottom - t * volumeChartHeight;
    }

    // сетка + шкала цен
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#8f98a3';
    ctx.strokeStyle = '#242933';

    const gridLines = 6;
    for (let i = 0; i <= gridLines; i++) {
      const t = i / gridLines;
      const price = minPrice + (maxPrice - minPrice) * (1 - t);
      const y = priceTop + t * priceChartHeight;

      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();

      const label = price.toFixed(2);
      ctx.fillText(label, priceScaleX, y + 3);
    }

    // свечи + объёмы
    visibleCandles.forEach((candle, index) => {
      const xCenter = paddingLeft + index * candleSpacing + candleSpacing / 2;

      const yOpen = priceToY(candle.open);
      const yClose = priceToY(candle.close);
      const yHigh = priceToY(candle.high);
      const yLow = priceToY(candle.low);

      const isBull = candle.close >= candle.open;
      const bodyColor = isBull ? '#3fd78a' : '#ff4f5a';
      const wickColor = '#cfd3dc22';

      // хвост
      ctx.strokeStyle = wickColor;
      ctx.beginPath();
      ctx.moveTo(xCenter, yHigh);
      ctx.lineTo(xCenter, yLow);
      ctx.stroke();

      // тело
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

      // объём
      const yVolumeTop = volumeToY(candle.volume);
      const volumeHeight = Math.max(1, volumeBottom - yVolumeTop);

      ctx.fillStyle = isBull ? '#3fd78a33' : '#ff4f5a33';
      ctx.fillRect(
        xCenter - volumeBarWidth / 2,
        yVolumeTop,
        volumeBarWidth,
        volumeHeight
      );
    });

    // шкала объёмов
    const volumeTicks = 3;
    ctx.fillStyle = '#6f7683';
    for (let i = 1; i <= volumeTicks; i++) {
      const t = i / volumeTicks;
      const vol = maxVolume * t;
      const y = volumeBottom - t * volumeChartHeight;
      const label = String(Math.round(vol));
      ctx.fillText(label, priceScaleX, y + 3);
    }

    // разделительная линия между ценой и объёмом
    ctx.strokeStyle = '#2e3440';
    ctx.beginPath();
    ctx.moveTo(paddingLeft, volumeTop);
    ctx.lineTo(chartRight, volumeTop);
    ctx.stroke();

    // временная шкала
    const timeTickEvery = Math.max(1, Math.floor(n / 6));
    ctx.fillStyle = '#8f98a3';
    ctx.textAlign = 'center';

    for (let i = 0; i < n; i += timeTickEvery) {
      const candle = visibleCandles[i];
      const xCenter = paddingLeft + i * candleSpacing + candleSpacing / 2;
      const y = volumeBottom + 12;

      const date = new Date(candle.time.replace(' ', 'T'));
      let label = '';
      if (!isNaN(date.getTime())) {
        if (barsPerScreen > 60) {
          const d = String(date.getDate()).padStart(2, '0');
          const m = String(date.getMonth() + 1).padStart(2, '0');
          label = `${d}.${m}`;
        } else {
          const h = String(date.getHours()).padStart(2, '0');
          const min = String(date.getMinutes()).padStart(2, '0');
          label = `${h}:${min}`;
        }
      } else {
        label = candle.time;
      }

      ctx.save();
      ctx.fillText(label, xCenter, y);
      ctx.restore();

      ctx.strokeStyle = '#242933';
      ctx.beginPath();
      ctx.moveTo(xCenter, volumeBottom);
      ctx.lineTo(xCenter, volumeBottom + 4);
      ctx.stroke();
    }

    ctx.textAlign = 'left';

    // ================= ОСНОВНОЙ ПРОФИЛЬ СПРАВА =================
    if (profileVisible) {
      const profileOptions =
        profileStepMode === '50'
          ? { mode: 'levels', levels: 50 }
          : profileStepMode === '100'
          ? { mode: 'levels', levels: 100 }
          : { mode: 'auto' };

      const {
        bins,
        priceStep,
        maxBinVolume,
        pocPrice,
        vahPrice,
        valPrice
      } = buildVolumeProfileFromCandles(
        visibleCandles,
        minPrice,
        maxPrice,
        profileOptions
      );

      // value area
      if (vahPrice != null && valPrice != null && vahPrice > valPrice) {
        const yVal = priceToY(valPrice);
        const yVah = priceToY(vahPrice);
        const top = Math.min(yVal, yVah);
        const bottom = Math.max(yVal, yVah);
        const h = bottom - top;

        ctx.save();
        ctx.fillStyle = profileColor || '#4c566a';
        const alpha = Math.max(0, Math.min(1, profileVaOpacity ?? 0.4));
        ctx.globalAlpha = alpha;
        ctx.fillRect(paddingLeft, top, chartRight - paddingLeft, h);
        ctx.restore();
      }

      // полосы профиля
      ctx.save();
      ctx.fillStyle = profileColor || '#4c566a';
      ctx.globalAlpha = 0.9;
      bins.forEach((bin) => {
        const y = priceToY(bin.price);
        const yNext = priceToY(bin.price + priceStep);
        const h = Math.max(1, Math.abs(yNext - y));

        const wRatio = bin.volume / maxBinVolume;
        const w = 4 + wRatio * (profileRight - profileLeft - 6);
        const xLeft = profileRight - w;

        ctx.fillRect(xLeft, y - h / 2, w, h);
      });
      ctx.restore();

      // POC
      if (pocPrice != null) {
        const yPoc = priceToY(pocPrice);

        ctx.save();
        ctx.strokeStyle = profilePocColor || '#facc15';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, yPoc);
        ctx.lineTo(chartRight, yPoc);
        ctx.stroke();
        ctx.setLineDash([]);

        const pocLabel = 'POC';
        ctx.font = '10px sans-serif';
        ctx.fillStyle = profilePocColor || '#facc15';
        ctx.fillText(pocLabel, priceScaleX, yPoc - 6);
        ctx.restore();
      }
    }

    // ================= RANGE-ПРОФИЛЬ СПРАВА ОТ ВЫДЕЛЕНИЯ =================
    if (
      rangeProfileEnabled &&
      selectionRange &&
      selectionRange.startIndex != null &&
      selectionRange.endIndex != null
    ) {
      let s = Math.max(
        0,
        Math.min(n - 1, selectionRange.startIndex)
      );
      let e = Math.max(
        0,
        Math.min(n - 1, selectionRange.endIndex)
      );
      if (e < s) [s, e] = [e, s];

      if (e > s) {
        const selLeftX = paddingLeft + s * candleSpacing;
        const selRightX =
          paddingLeft + (e + 1) * candleSpacing;

        // прямоугольник выделения
        ctx.save();
        ctx.fillStyle = '#4b556333';
        const rectWidth = selRightX - selLeftX;
        ctx.fillRect(selLeftX, priceTop, rectWidth, priceChartHeight);
        ctx.strokeStyle = '#9ca3af';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
          selLeftX,
          priceTop,
          rectWidth,
          priceChartHeight
        );
        ctx.restore();

        // свечи внутри диапазона
        const selectedCandles = visibleCandles.slice(s, e + 1);

        if (selectedCandles.length >= 3) {
          const rangeOptions =
            profileStepMode === '50'
              ? { mode: 'levels', levels: 50 }
              : profileStepMode === '100'
              ? { mode: 'levels', levels: 100 }
              : { mode: 'auto' };

          const { bins, priceStep, maxBinVolume } =
            buildVolumeProfileFromCandles(
              selectedCandles,
              minPrice,
              maxPrice,
              rangeOptions
            );

          if (bins.length > 0 && maxBinVolume > 0) {
            // область для range-профиля справа от выделения
            const availableRight = chartRight - selRightX - 6;
            if (availableRight > 10) {
              const rangeProfileWidth = Math.min(
                100,
                availableRight
              );
              const rangeLeft = selRightX + 4;
              const rangeRight = rangeLeft + rangeProfileWidth;

              ctx.save();
              ctx.fillStyle = profileColor || '#4c566a';
              ctx.globalAlpha = 0.9;

              bins.forEach((bin) => {
                const y = priceToY(bin.price);
                const yNext = priceToY(bin.price + priceStep);
                const h = Math.max(1, Math.abs(yNext - y));

                const wRatio = bin.volume / maxBinVolume;
                const w =
                  2 + wRatio * (rangeProfileWidth - 4);
                const xLeft = rangeRight - w;

                ctx.fillRect(xLeft, y - h / 2, w, h);
              });

              ctx.restore();
            }
          }
        }
      }
    }

    // ================= ПЕРЕКРЕСТИЕ =================
    if (crossVisible) {
      const { x, y } = crossPos;
      const clampedX = Math.min(
        chartRight,
        Math.max(paddingLeft, x)
      );
      const clampedY = Math.min(
        paddingTop + fullChartHeight,
        Math.max(paddingTop, y)
      );

      let index = Math.floor(
        (clampedX - paddingLeft) / candleSpacing
      );
      index = Math.min(n - 1, Math.max(0, index));

      const candle = visibleCandles[index];
      const priceAtCursor = yToPrice(clampedY);

      ctx.save();
      ctx.strokeStyle = '#bbbbbb';
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(clampedX, paddingTop);
      ctx.lineTo(clampedX, height - paddingBottom);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(paddingLeft, clampedY);
      ctx.lineTo(chartRight, clampedY);
      ctx.stroke();

      ctx.restore();

      // ценовой label
      const priceLabel = priceAtCursor.toFixed(2);
      ctx.font = '10px sans-serif';
      const plWidth = ctx.measureText(priceLabel).width + 8;
      const plHeight = 14;
      const plX = priceScaleX;
      const plY = clampedY - plHeight / 2;

      ctx.fillStyle = '#2b303b';
      ctx.fillRect(plX, plY, plWidth, plHeight);
      ctx.strokeStyle = '#4c566a';
      ctx.strokeRect(plX, plY, plWidth, plHeight);

      ctx.fillStyle = '#e5e9f0';
      ctx.fillText(priceLabel, plX + 4, plY + plHeight - 4);

      // временной label
      const date = new Date(candle.time.replace(' ', 'T'));
      let timeLabel = candle.time;
      if (!isNaN(date.getTime())) {
        const ymd = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const hm = `${String(date.getHours()).padStart(2, '0')}:${String(
          date.getMinutes()
        ).padStart(2, '0')}`;
        timeLabel = `${ymd} ${hm}`;
      }

      const tlWidth = ctx.measureText(timeLabel).width + 8;
      const tlHeight = 14;
      const tlX = clampedX - tlWidth / 2;
      const tlY = volumeBottom + 6;

      ctx.fillStyle = '#2b303b';
      ctx.fillRect(tlX, tlY, tlWidth, tlHeight);
      ctx.strokeStyle = '#4c566a';
      ctx.strokeRect(tlX, tlY, tlWidth, tlHeight);

      ctx.fillStyle = '#e5e9f0';
      ctx.fillText(timeLabel, tlX + 4, tlY + tlHeight - 4);
    }
  }, [
    candles,
    size,
    barsPerScreen,
    rightOffset,
    crossVisible,
    crossPos,
    profileStepMode,
    profileVisible,
    profileColor,
    profilePocColor,
    profileVaOpacity,
    profileWidth,
    rangeProfileEnabled,
    selectionRange
  ]);

  // ================= ОБРАБОТЧИКИ МЫШИ =================

  function indexFromX(x) {
    const { paddingLeft, chartRight, fullChartWidth, n } =
      chartParamsRef.current;
    if (n <= 0 || fullChartWidth <= 0) return null;
    if (x < paddingLeft || x > chartRight) return null;

    const candleSpacing = fullChartWidth / n;
    let idx = Math.floor((x - paddingLeft) / candleSpacing);
    idx = Math.max(0, Math.min(n - 1, idx));
    return idx;
  }

  function handleMouseDown(e) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.button === 1) {
      // средняя кнопка — перекрестие
      e.preventDefault();
      setMiddleDown(true);
      setCrossPos({ x, y });
      setCrossVisible(true);
      return;
    }

    if (e.button === 2) {
      // ПКМ — панорамирование
      e.preventDefault();
      setIsPanning(true);
      setPanStartX(x);
      setPanStartOffset(rightOffset);
      return;
    }

    if (e.button === 0 && rangeProfileEnabled) {
      // ЛКМ — начало range-выделения
      e.preventDefault();
      const idx = indexFromX(x);
      if (idx == null) return;
      setDragSelecting(true);
      setSelectionRange({ startIndex: idx, endIndex: idx });
      return;
    }
  }

  function handleMouseMove(e) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (middleDown && crossVisible) {
      setCrossPos({ x, y });
    }

    if (isPanning) {
      // панорамирование
      const { fullChartWidth } = chartParamsRef.current;
      if (!candles || candles.length === 0 || fullChartWidth <= 0) return;

      const total = candles.length;
      const bars = Math.min(total, Math.max(20, barsPerScreen));
      const maxOffset = Math.max(0, total - bars);

      const dx = x - panStartX;
      const candlesPerPixel = bars / fullChartWidth;
      const deltaCandles = Math.round(-dx * candlesPerPixel); // вправо — к более новым барам

      let newOffset = panStartOffset + deltaCandles;
      if (newOffset < 0) newOffset = 0;
      if (newOffset > maxOffset) newOffset = maxOffset;
      setRightOffset(newOffset);
    }

    if (dragSelecting && rangeProfileEnabled) {
      const idx = indexFromX(x);
      if (idx == null) return;
      setSelectionRange((prev) =>
        prev ? { ...prev, endIndex: idx } : { startIndex: idx, endIndex: idx }
      );
    }
  }

  function handleMouseUp(e) {
    if (e.button === 1) {
      setMiddleDown(false);
      setCrossVisible(false);
    }

    if (e.button === 2) {
      setIsPanning(false);
    }

    if (e.button === 0 && dragSelecting) {
      setDragSelecting(false);
      setSelectionRange((prev) => {
        if (!prev) return null;
        if (
          prev.startIndex == null ||
          prev.endIndex == null ||
          Math.abs(prev.endIndex - prev.startIndex) < 1
        ) {
          // слишком маленький диапазон — сбрасываем
          return null;
        }
        return prev;
      });
    }
  }

  function handleMouseLeave() {
    setMiddleDown(false);
    setCrossVisible(false);
    setIsPanning(false);
    if (dragSelecting) setDragSelecting(false);
  }

  // запрещаем стандартное контекстное меню на ПКМ
  function handleContextMenu(e) {
    e.preventDefault();
  }

  function handleWheel(e) {
    if (!candles || candles.length === 0) return;
    e.preventDefault();

    const delta = e.deltaY;
    setBarsPerScreen((prev) => {
      let next = prev;
      if (delta < 0) {
        next = Math.max(20, Math.round(prev * 0.9)); // приблизить
      } else {
        next = Math.round(prev / 0.9); // отдалить
      }
      return Math.min(1000, next);
    });
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#111317'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor:
            middleDown || (rangeProfileEnabled && dragSelecting)
              ? 'crosshair'
              : isPanning
              ? 'grabbing'
              : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}

export default CandlesChart;

// client/src/App.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import CandlesChart from './components/CandlesChart';

// Базовый список инструментов (для быстрого доступа).
const INSTRUMENTS = [
  'SBER',
  'GAZP',
  'LKOH',
  'GMKN',
  'ROSN',
  'VTBR',
  'MTSS',
  'NVTK',
  'CHMF',
  'PLZL'
];

function App() {
  const [symbol, setSymbol] = useState('SBER');
  const [timeframe, setTimeframe] = useState('1d');

  const [loading, setLoading] = useState(false);
  const [candlesInfo, setCandlesInfo] = useState(null);
  const [error, setError] = useState(null);

  // Профиль: режим шага
  const [profileStepMode, setProfileStepMode] = useState('auto');
  // Профиль: включен/выключен
  const [profileVisible, setProfileVisible] = useState(true);
  // Цвет профиля и POC
  const [profileColor, setProfileColor] = useState('#4c566a');
  const [profilePocColor, setProfilePocColor] = useState('#facc15');
  // Прозрачность зоны Value Area
  const [profileVaOpacity, setProfileVaOpacity] = useState(0.4);
  // Ширина блока профиля (толщина)
  const [profileWidth, setProfileWidth] = useState(80);

  // Range-профиль (по выделенному диапазону)
  const [rangeProfileEnabled, setRangeProfileEnabled] = useState(true);

  async function fetchCandles(sym, tf, { preserveOld = true } = {}) {
    try {
      setLoading(true);
      setError(null);
      if (!preserveOld) {
        setCandlesInfo(null);
      }

      const response = await axios.get('http://localhost:3000/api/candles', {
        params: {
          symbol: sym.trim(),
          tf
        }
      });

      setCandlesInfo(response.data);
    } catch (err) {
      console.error('Error loading candles:', err);
      setError(err.response?.data?.details || err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Автоматическая загрузка/перезагрузка при изменении symbol или timeframe
  useEffect(() => {
    const sym = symbol;
    const tf = timeframe;

    const timerId = setTimeout(() => {
      fetchCandles(sym, tf, { preserveOld: true });
    }, 400);

    return () => clearTimeout(timerId);
  }, [symbol, timeframe]);

  return (
    <div
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'sans-serif',
        backgroundColor: '#111317',
        color: '#e5e9f0'
      }}
    >
      {/* Верхняя панель управления */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #242933',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap',
          flexShrink: 0
        }}
      >
        <h1 style={{ margin: 0, fontSize: '16px' }}>MOEX Viewer (черновик)</h1>

        <label style={{ fontSize: '13px' }}>
          &nbsp;Инструмент:&nbsp;
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            style={{
              width: '80px',
              backgroundColor: '#1b1f27',
              border: '1px solid #3b4252',
              color: '#e5e9f0',
              padding: '2px 4px',
              fontSize: '13px'
            }}
          />
        </label>

        <label style={{ fontSize: '13px' }}>
          &nbsp;Таймфрейм:&nbsp;
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{
              backgroundColor: '#1b1f27',
              border: '1px solid #3b4252',
              color: '#e5e9f0',
              padding: '2px 4px',
              fontSize: '13px'
            }}
          >
            <option value="1d">1d (день)</option>
            <option value="1h">1h (час)</option>
            <option value="10m">10m</option>
          </select>
        </label>

        {/* Настройки основного профиля */}
        <label
          style={{
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <input
            type="checkbox"
            checked={profileVisible}
            onChange={(e) => setProfileVisible(e.target.checked)}
          />
          Профиль
        </label>

        <label style={{ fontSize: '13px' }}>
          шаг:&nbsp;
          <select
            value={profileStepMode}
            onChange={(e) => setProfileStepMode(e.target.value)}
            style={{
              backgroundColor: '#1b1f27',
              border: '1px solid #3b4252',
              color: '#e5e9f0',
              padding: '2px 4px',
              fontSize: '13px'
            }}
          >
            <option value="auto">auto</option>
            <option value="50">≈50 уровней</option>
            <option value="100">≈100 уровней</option>
          </select>
        </label>

        <label
          style={{
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          цвет:&nbsp;
          <input
            type="color"
            value={profileColor}
            onChange={(e) => setProfileColor(e.target.value)}
            style={{
              width: 26,
              height: 18,
              padding: 0,
              border: '1px solid #3b4252',
              background: '#1b1f27'
            }}
          />
        </label>

        <label
          style={{
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          POC:&nbsp;
          <input
            type="color"
            value={profilePocColor}
            onChange={(e) => setProfilePocColor(e.target.value)}
            style={{
              width: 26,
              height: 18,
              padding: 0,
              border: '1px solid #3b4252',
              background: '#1b1f27'
            }}
          />
        </label>

        <label
          style={{
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          VA:&nbsp;
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={profileVaOpacity}
            onChange={(e) => setProfileVaOpacity(parseFloat(e.target.value))}
          />
        </label>

        <label
          style={{
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          ширина:&nbsp;
          <input
            type="range"
            min="40"
            max="160"
            step="5"
            value={profileWidth}
            onChange={(e) => setProfileWidth(parseInt(e.target.value, 10))}
          />
        </label>

        {/* Range-профиль */}
        <label
          style={{
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <input
            type="checkbox"
            checked={rangeProfileEnabled}
            onChange={(e) => setRangeProfileEnabled(e.target.checked)}
          />
          Range проф.
        </label>

        <button
          onClick={() => fetchCandles(symbol, timeframe, { preserveOld: false })}
          disabled={loading}
          style={{
            padding: '4px 10px',
            fontSize: '13px',
            backgroundColor: loading ? '#4c566a' : '#3b82f6',
            border: 'none',
            borderRadius: '3px',
            color: '#fff',
            cursor: loading ? 'default' : 'pointer'
          }}
        >
          {loading ? 'Загружаю...' : 'Обновить'}
        </button>

        {loading && (
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            &nbsp;…обновление графика
          </span>
        )}

        {error && (
          <span
            style={{
              color: '#ff6b6b',
              marginLeft: '8px',
              fontSize: '12px'
            }}
          >
            <strong>Ошибка:</strong> {error}
          </span>
        )}
      </div>

      {/* Основная область: инфо + график + список инструментов справа */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Инфо под шапкой */}
        {candlesInfo && (
          <div
            style={{
              padding: '4px 16px',
              fontSize: '12px',
              color: '#d8dee9',
              borderBottom: '1px solid #242933',
              flexShrink: 0
            }}
          >
            <span>
              <strong>Инструмент:</strong> {candlesInfo.symbol}
            </span>
            &nbsp;|&nbsp;
            <span>
              <strong>Таймфрейм:</strong> {candlesInfo.timeframe}
            </span>
            &nbsp;|&nbsp;
            <span>
              <strong>Диапазон:</strong> {candlesInfo.from} →{' '}
              {candlesInfo.till}
            </span>
            &nbsp;|&nbsp;
            <span>
              <strong>Свечей:</strong> {candlesInfo.candlesCount}
            </span>
          </div>
        )}

        {/* Центр: слева график, справа список тикеров */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            overflow: 'hidden'
          }}
        >
          {/* Левая область — график */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden'
            }}
          >
            {candlesInfo ? (
              <CandlesChart
                candles={candlesInfo.candles}
                profileStepMode={profileStepMode}
                profileVisible={profileVisible}
                profileColor={profileColor}
                profilePocColor={profilePocColor}
                profileVaOpacity={profileVaOpacity}
                profileWidth={profileWidth}
                rangeProfileEnabled={rangeProfileEnabled}
              />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  fontSize: '14px'
                }}
              >
                {loading
                  ? 'Загружаю данные...'
                  : 'Нет данных — выбери инструмент/таймфрейм'}
              </div>
            )}
          </div>

          {/* Правая область — список инструментов */}
          <div
            style={{
              width: '140px',
              borderLeft: '1px solid #242933',
              backgroundColor: '#06080c',
              padding: '6px 4px',
              fontSize: '12px',
              flexShrink: 0,
              overflowY: 'auto'
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                marginBottom: '4px',
                padding: '2px 4px',
                color: '#9ca3af'
              }}
            >
              Инструменты
            </div>

            {INSTRUMENTS.map((ticker) => {
              const active = ticker === symbol;
              return (
                <div
                  key={ticker}
                  onClick={() => setSymbol(ticker)}
                  style={{
                    padding: '4px 6px',
                    marginBottom: '2px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    backgroundColor: active ? '#1f2937' : 'transparent',
                    color: active ? '#e5e9f0' : '#9ca3af'
                  }}
                >
                  {ticker}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

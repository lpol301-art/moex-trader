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

function ToolbarDropdown({ label, children, minWidth = 280 }) {
  return (
    <details
      style={{
        position: 'relative',
        display: 'inline-block',
        backgroundColor: '#0b1020',
        border: '1px solid #111827',
        borderRadius: 6,
        padding: '4px 10px',
        color: '#e5e9f0'
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          userSelect: 'none',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13
        }}
      >
        <span>{label}</span>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>▼</span>
      </summary>
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 20,
          minWidth,
          background: 'linear-gradient(180deg, #0b1020, #0f172a)',
          border: '1px solid #111827',
          borderRadius: 8,
          padding: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        {children}
      </div>
    </details>
  );
}

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
  // Показывать ли POC (линия + жирная ступенька)
  const [profileShowPoc, setProfileShowPoc] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const api = axios.create({ baseURL: API_BASE_URL });

  // Авто-профили (день / неделя / сессия)
  const [autoDayProfile, setAutoDayProfile] = useState(true);
  const [autoWeekProfile, setAutoWeekProfile] = useState(false);
  const [autoSessionProfile, setAutoSessionProfile] = useState(true);
  const [autoMonthProfile, setAutoMonthProfile] = useState(false);
  const [autoVisibleProfile, setAutoVisibleProfile] = useState(true);

  async function fetchCandles(sym, tf, { preserveOld = true } = {}) {
    try {
      setLoading(true);
      setError(null);
      if (!preserveOld) {
        setCandlesInfo(null);
      }

      const response = await api.get('/api/candles', {
        params: {
          symbol: sym.trim(),
          tf
        }
      });

      setCandlesInfo(response.data);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.details ||
          err?.response?.data?.message ||
          err.message ||
          'Ошибка загрузки'
      );
    } finally {
      setLoading(false);
    }
  }

  // Если меняем инструмент/таймфрейм — перезапрашиваем данные
  useEffect(() => {
    fetchCandles(symbol, timeframe, { preserveOld: false });
  }, [symbol, timeframe]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#020617',
        color: '#e5e9f0',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px'
      }}
    >
      {/* Верхняя панель: выбор инструмента, ТФ, настройки */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #111827',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background:
            'linear-gradient(to right, rgba(15,23,42,0.95), rgba(15,23,42,0.85))',
          boxShadow: '0 1px 0 rgba(15,23,42,0.9)'
        }}
      >
        {/* Инструмент */}
        <label style={{ fontSize: '13px' }}>
          Инструмент:&nbsp;
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            style={{
              width: 80,
              backgroundColor: '#020617',
              border: '1px solid #1f2937',
              borderRadius: 4,
              padding: '2px 4px',
              color: '#e5e9f0'
            }}
          />
        </label>

        {/* Таймфрейм */}
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

        <ToolbarDropdown label="Профиль">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10
            }}
          >
            <label
              style={{
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <input
                type="checkbox"
                checked={profileVisible}
                onChange={(e) => setProfileVisible(e.target.checked)}
              />
              Показывать профиль
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
                  fontSize: '13px',
                  width: '100%'
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
                gap: 6
              }}
            >
              цвет:&nbsp;
              <input
                type="color"
                value={profileColor}
                onChange={(e) => setProfileColor(e.target.value)}
                style={{
                  width: 30,
                  height: 20,
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
                gap: 6,
                flexWrap: 'wrap'
              }}
            >
              POC:&nbsp;
              <input
                type="checkbox"
                checked={profileShowPoc}
                onChange={(e) => setProfileShowPoc(e.target.checked)}
              />
              <span style={{ color: '#9ca3af' }}>цвет:</span>
              <input
                type="color"
                value={profilePocColor}
                onChange={(e) => setProfilePocColor(e.target.value)}
                style={{
                  width: 30,
                  height: 20,
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
                gap: 8
              }}
            >
              VA:&nbsp;
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={profileVaOpacity}
                onChange={(e) =>
                  setProfileVaOpacity(parseFloat(e.target.value))
                }
                style={{ flex: 1 }}
              />
            </label>

            <label
              style={{
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              ширина:&nbsp;
              <input
                type="range"
                min="40"
                max="160"
                step="5"
                value={profileWidth}
                onChange={(e) =>
                  setProfileWidth(parseInt(e.target.value, 10))
                }
                style={{ flex: 1 }}
              />
            </label>
          </div>
        </ToolbarDropdown>

        <ToolbarDropdown label="Диапазоны" minWidth={320}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Авто-профили:</span>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={autoDayProfile}
                onChange={(e) => setAutoDayProfile(e.target.checked)}
              />
              День
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={autoWeekProfile}
                onChange={(e) => setAutoWeekProfile(e.target.checked)}
              />
              Неделя
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={autoSessionProfile}
                onChange={(e) => setAutoSessionProfile(e.target.checked)}
              />
              Сессия
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={autoMonthProfile}
                onChange={(e) => setAutoMonthProfile(e.target.checked)}
              />
              Месяц
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={autoVisibleProfile}
                onChange={(e) => setAutoVisibleProfile(e.target.checked)}
              />
              Весь видимый диапазон
            </label>
          </div>
        </ToolbarDropdown>

        {/* Кнопка принудительного обновления */}
        <button
          onClick={() => fetchCandles(symbol, timeframe, { preserveOld: false })}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            fontSize: '13px',
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #4b5563',
            backgroundColor: loading ? '#111827' : '#1f2937',
            color: '#e5e9f0',
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
          padding: '8px 8px 8px 8px',
          gap: 8
        }}
      >
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
                profileShowPoc={profileShowPoc}
                autoDayProfile={autoDayProfile}
                autoWeekProfile={autoWeekProfile}
                autoSessionProfile={autoSessionProfile}
                autoMonthProfile={autoMonthProfile}
                autoVisibleProfile={autoVisibleProfile}
              />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  fontSize: '13px'
                }}
              >
                Нет данных для отображения
              </div>
            )}
          </div>

          {/* Правая колонка — список базовых тикеров */}
          <div
            style={{
              width: 120,
              borderLeft: '1px solid #111827',
              paddingLeft: 6,
              paddingRight: 4,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              fontSize: '13px'
            }}
          >
            <div
              style={{
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

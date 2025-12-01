// server/src/index.js

const express = require('express');
const cors = require('cors');

const app = express();

// Разрешённые источники по умолчанию для локальной разработки (Vite/React)
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

// Если нужно, можно пробросить список через переменную окружения CORS_ORIGINS (через запятую).
const configuredOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : defaultAllowedOrigins;

const allowAllOrigins = configuredOrigins.length === 0;

// Гибкие CORS-настройки: никогда не падаем ошибкой, просто предупреждаем в логе, если источник неожиданный.
const corsOptions = {
  origin: (origin, callback) => {
    // Разрешаем запросы без Origin (например, curl или тесты)
    if (!origin) {
      return callback(null, true);
    }

    if (allowAllOrigins || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Origin ${origin} is not in whitelist, allowing for local dev.`);
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 204
};

// Базовые middlewares
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Дублируем основные заголовки руками, чтобы даже при ошибках клиент получал CORS-заголовки.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowedOrigin = allowAllOrigins || !origin || configuredOrigins.includes(origin);
  const headerOrigin = isAllowedOrigin ? origin || '*' : '*';

  res.header('Access-Control-Allow-Origin', headerOrigin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

// Подключаем маршруты
const healthRoute = require('./routes/healthRoute');
const candleRoute = require('./routes/candleRoute');

app.use('/api', healthRoute);
app.use('/api', candleRoute);

// Порт сервера
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

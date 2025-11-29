// server/src/index.js

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Базовые middlewares
app.use(cors());
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

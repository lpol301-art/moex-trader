// server/src/routes/candleRoute.js

const express = require('express');
const { getCandles } = require('../controllers/candleController');

const router = express.Router();

// GET /api/candles?symbol=SBER&tf=1d
router.get('/candles', getCandles);

module.exports = router;

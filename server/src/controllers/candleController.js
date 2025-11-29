// server/src/controllers/candleController.js

const { fetchCandlesFromMoex } = require('../services/moexService');

async function getCandles(req, res) {
  try {
    const symbol = (req.query.symbol || 'SBER').toUpperCase();
    const tf = req.query.tf || '1d';

    const data = await fetchCandlesFromMoex(symbol, tf);

    res.json(data);
  } catch (err) {
    console.error('Error in getCandles:', err);
    res.status(500).json({
      error: 'server_error',
      details: err.message || String(err)
    });
  }
}

module.exports = {
  getCandles
};

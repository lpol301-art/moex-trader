// server/src/routes/healthRoute.js

const express = require('express');
const router = express.Router();

// GET /api/ping
router.get('/ping', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is alive',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

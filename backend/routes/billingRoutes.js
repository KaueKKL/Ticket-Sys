const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { protect } = require('../middleware/authMiddleware');

// Rota protegida para gerar DAV
router.post('/generate', protect, billingController.generateDav);

module.exports = router;
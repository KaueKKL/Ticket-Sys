const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { protect } = require('../middleware/authMiddleware');

// Define o endpoint POST /api/billing/generate
router.post('/generate', protect, billingController.generateDav);

module.exports = router;
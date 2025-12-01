const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { protect } = require('../middleware/authMiddleware');

router.get('/search', protect, clientController.searchClients);

module.exports = router;
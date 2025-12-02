const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/options', protect, integrationController.getLegacyOptions);
router.post('/config', protect, integrationController.saveIntegrationConfig);

module.exports = router;
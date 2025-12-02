const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/options', protect, integrationController.getLegacyOptions);
router.post('/config', protect, integrationController.saveIntegrationConfig);

router.post('/test-insert', protect, integrationController.testLegacyInsert);
router.post('/test-remove', protect, integrationController.testLegacyRemove);

router.post('/test-full-os', protect, integrationController.testFullOsGeneration);
router.delete('/test-full-os/:id', protect, integrationController.rollbackTestOs);

module.exports = router;
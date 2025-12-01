const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/dashboard/stats', protect, dashboardController.getDashboardStats);

router.post('/', protect, ticketController.createTicket);
router.get('/', protect, ticketController.getTickets);
router.post('/:id/notes', protect, ticketController.addTicketNote);

router.get('/:id', protect, ticketController.getTicketById);
router.put('/:id', protect, ticketController.updateTicket);
router.delete('/:id', protect, ticketController.deleteTicket);

module.exports = router;
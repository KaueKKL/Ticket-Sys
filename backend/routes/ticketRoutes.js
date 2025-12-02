const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

// GET ROUTES
router.get('/', protect, ticketController.getTickets);
router.get('/:id', protect, ticketController.getTicketById);
router.get('/dashboard/stats', protect, dashboardController.getDashboardStats);

// POST ROUTES
router.post('/', protect, ticketController.createTicket);
router.post('/:id/notes', protect, ticketController.addTicketNote);

// PATCH ROUTES
router.patch('/:id/status', protect, ticketController.toggleTicketStatus);

// PUT ROUTES
router.put('/:id', protect, ticketController.updateTicket);

// DELETE ROUTES
router.delete('/:id', protect, ticketController.deleteTicket);

module.exports = router;
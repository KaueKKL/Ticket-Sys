const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUsers , updateUser, deleteUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', registerUser);     // Criar usuário
router.post('/login', loginUser);   // Login
router.get('/', protect, getUsers); // Listar usuários (Protegido)
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, deleteUser);

module.exports = router;
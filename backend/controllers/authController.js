const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Gera o Token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || '@0Dcapkdd2025', {
    expiresIn: '30d',
  });
};

// @desc    Registrar novo usuário
// @route   POST /api/users
exports.registerUser = async (req, res) => {
  const { name, email, password, isAdmin } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'Este email já está cadastrado.' });
    }

    const user = await User.create({
      name,
      email,
      password,
      isAdmin: isAdmin || false
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(400).json({ message: 'Dados inválidos ou erro no servidor.' });
  }
};

// @desc    Autenticar usuário e gerar token
// @route   POST /api/users/login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Email ou senha inválidos' });
    }
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Listar todos os usuários
// @route   GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Atualizar usuário (CORRIGIDO)
// @route   PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      
      if (req.body.isAdmin !== undefined) {
        user.isAdmin = req.body.isAdmin;
      }
      
      // Só atualiza a senha se não for vazia
      if (req.body.password && req.body.password.trim() !== '') {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
      });
    } else {
      res.status(404).json({ message: 'Usuário não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    
    // Tratamento específico de erros
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'ID de usuário inválido.' });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Este email já está em uso.' });
    }
    
    // Retorna o erro real em vez de uma mensagem genérica
    res.status(500).json({ message: error.message || 'Erro ao processar atualização.' });
  }
};

// @desc    Deletar usuário
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      await User.findByIdAndDelete(req.params.id);
      res.json({ message: 'Usuário removido com sucesso' });
    } else {
      res.status(404).json({ message: 'Usuário não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'ID de usuário inválido.' });
    }
    res.status(500).json({ message: error.message || 'Erro ao deletar usuário.' });
  }
};
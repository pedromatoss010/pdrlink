const { body } = require('express-validator');

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/) // só letras, números e underscore
    .withMessage('Username deve ter 3-30 caracteres, só letras/números/_'),
  body('email').trim().isEmail().withMessage('E-mail inválido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres')
];

module.exports = { registerValidation };
const { body } = require('express-validator');

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username deve ter 3-30 caracteres, só letras/números/_'),
  body('email').trim().isEmail().withMessage('E-mail inválido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  body('accepted_terms')
    .equals('true')
    .withMessage('É necessário aceitar os Termos de Uso e a Política de Privacidade')
];

module.exports = { registerValidation };
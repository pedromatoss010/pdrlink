const { body } = require('express-validator');

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username deve ter 3-30 caracteres, só letras/números/_'),
  body('email').trim().isEmail().withMessage('E-mail inválido'),
body('password')
  .isString()
  .withMessage('Senha deve ser um texto válido')
  .isLength({ min: 8, max: 72 })
  .withMessage('Senha deve ter entre 8 e 72 caracteres')
  .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
  .withMessage('A senha deve conter pelo menos uma letra e um número'),
  body('account_type')
    .optional()
    .isIn(['pessoa', 'loja'])
    .withMessage('Tipo de conta inválido'),
  body('accepted_terms')
    .equals('true')
    .withMessage('É necessário aceitar os Termos de Uso e a Política de Privacidade')
];

module.exports = { registerValidation };
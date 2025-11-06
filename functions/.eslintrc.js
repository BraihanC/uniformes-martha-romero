/* eslint-env node */
/* eslint-disable no-undef */
module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true, // <-- Esta es la corrección clave
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "quotes": ["error", "double"],
    "indent": ["error", 2],
    "object-curly-spacing": ["error", "always"],
    // Aumentamos el límite de longitud de línea para evitar errores en las funciones
    "max-len": ["error", { "code": 140 }],
    // Permitir parámetros no usados si empiezan con guion bajo
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
  },
  parserOptions: {
    // Soporte para CommonJS (el sistema de 'require' y 'module.exports')
    ecmaVersion: 2021,
  },
};

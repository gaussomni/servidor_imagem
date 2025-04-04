const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const methodOverride = require('method-override');

// Configurações básicas
const app = express();
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// Rotas estáticas
app.use(express.static(path.join(__dirname, '../public')));

// Definir storage como variável de ambiente na Vercel
// Isso usará /tmp para armazenamento temporário
const STORAGE_DIR = process.env.VERCEL ? '/tmp/storage' : path.join(__dirname, '../storage');
app.use('/storage', express.static(STORAGE_DIR));

// Garantir que a pasta storage exista
fs.ensureDirSync(STORAGE_DIR);

// Importar rotas do dashboard
const dashboardRoutes = require('../routes/dashboard');
app.use('/', dashboardRoutes);

// Tratamento de erros 404
app.use((req, res) => {
  res.status(404).send('Página não encontrada');
});

// Iniciar servidor apenas em ambiente de desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

// Exportar para Vercel
module.exports = app; 
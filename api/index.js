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

// Rota básica para testes
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Servidor de imagens está funcionando'
  });
});

// Rota para verificar ambiente
app.get('/info', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || 'development',
    vercel: process.env.VERCEL || false,
    tempDir: process.env.VERCEL ? '/tmp' : 'storage',
    currentDir: __dirname
  });
});

// Tratamento de erros 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('Erro na aplicação:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
  });
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
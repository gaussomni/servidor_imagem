// Arquivo principal do app Node.js
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const methodOverride = require('method-override');
const app = express();
const port = 3010;

// Configurações do Express
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuração do method-override
app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    const method = req.body._method;
    delete req.body._method;
    return method;
  }
}));

// Criar pasta de storage e garantir que existe
const storagePath = path.join(__dirname, 'storage');
try {
  fs.ensureDirSync(storagePath);
  console.log('Pasta de storage criada/verificada com sucesso:', storagePath);
} catch (err) {
  console.error('Erro ao criar pasta storage:', err);
}

// Rotas
const dashboardRoutes = require('./routes/dashboard');
app.use('/', dashboardRoutes);

// Adicionar tratamento de erro 404
app.use((req, res, next) => {
  console.log('404 Not Found:', req.path);
  res.status(404).send('Página não encontrada');
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro na aplicação:', err);
  res.status(500).send('Erro interno do servidor: ' + err.message);
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor rodando em https://servidor-imagem-topaz.vercel.app/:${port}`);
});
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const methodOverride = require('method-override');

// Criando aplicação
const app = express();

// Configuração das views - ajustando caminho para que funcione na Vercel
const viewsPath = path.join(__dirname, '../views');
app.set('views', viewsPath);
app.set('view engine', 'ejs');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, '../public')));

// Pasta de armazenamento temporário para Vercel
const STORAGE_DIR = process.env.VERCEL ? '/tmp/storage' : path.join(__dirname, '../storage');
fs.ensureDirSync(STORAGE_DIR);
app.use('/storage', express.static(STORAGE_DIR));

// Rota raiz simples para verificar se está funcionando
app.get('/', (req, res) => {
  try {
    // Verifica se a pasta views existe
    console.log('Diretório views:', viewsPath);
    console.log('Existe:', fs.existsSync(viewsPath));
    console.log('Conteúdo:', fs.existsSync(viewsPath) ? fs.readdirSync(viewsPath) : 'N/A');
    
    // Renderização direta para teste
    res.render('dashboard', {
      title: 'Gerenciador de Imagens',
      pastas: [],
      caminhoAtual: ''
    });
  } catch (err) {
    console.error('Erro ao renderizar:', err);
    res.status(500).json({
      error: 'Erro ao renderizar view',
      message: err.message,
      viewsPath: viewsPath,
      exists: fs.existsSync(viewsPath),
      files: fs.existsSync(viewsPath) ? fs.readdirSync(viewsPath) : []
    });
  }
});

// Diagnóstico
app.get('/info', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || 'development',
    vercel: process.env.VERCEL || false,
    tempDir: STORAGE_DIR,
    viewsDir: viewsPath,
    viewsExist: fs.existsSync(viewsPath),
    viewsFiles: fs.existsSync(viewsPath) ? fs.readdirSync(viewsPath) : [],
    currentDir: __dirname,
    parentDir: path.dirname(__dirname),
    rootDir: path.resolve('.')
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

// Dev server
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3010;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app; 
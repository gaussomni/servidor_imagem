const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const methodOverride = require('method-override');

// Criar aplicação Express
const app = express();

// Configuração das views
const viewsPath = path.join(__dirname, '../views');
app.set('views', viewsPath);
app.set('view engine', 'ejs');

// Middleware básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, '../public')));

// Detectar ambiente
const isVercel = process.env.VERCEL === '1';
const isLocal = !isVercel;

// Configurar armazenamento
const STORAGE_DIR = isVercel ? '/tmp/storage' : path.join(__dirname, '../storage');
fs.ensureDirSync(STORAGE_DIR);
app.use('/storage', express.static(STORAGE_DIR));

// Configurar Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    try {
      const pasta = req.body.caminhoAtual || '';
      const destPath = path.join(STORAGE_DIR, pasta);
      fs.ensureDirSync(destPath);
      cb(null, destPath);
    } catch (err) {
      console.error("Erro ao configurar destino de upload:", err);
      cb(err);
    }
  },
  filename: function(req, file, cb) {
    try {
      const originalName = file.originalname;
      const ext = path.extname(originalName);
      const nameWithoutExt = path.basename(originalName, ext);
      
      const destPath = path.join(STORAGE_DIR, req.body.caminhoAtual || '');
      
      // Verificar se já existe um arquivo com o mesmo nome
      const checkDuplicate = (baseName, extension, counter = 0) => {
        let fileName = counter === 0 
          ? `${baseName}${extension}` 
          : `${baseName}(${counter})${extension}`;
          
        const filePath = path.join(destPath, fileName);
        
        if (fs.existsSync(filePath)) {
          return checkDuplicate(baseName, extension, counter + 1);
        } else {
          return fileName;
        }
      };
      
      const finalFileName = checkDuplicate(nameWithoutExt, ext);
      cb(null, finalFileName);
    } catch (err) {
      console.error("Erro ao gerar nome do arquivo:", err);
      cb(err);
    }
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: function(req, file, cb) {
    try {
      const extname = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype = file.mimetype.startsWith('image/');
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        return cb(new Error('Apenas imagens (jpg, jpeg, png, gif, webp) são permitidas!'));
      }
    } catch (err) {
      console.error("Erro no filtro de arquivo:", err);
      cb(err);
    }
  }
});

// Funções para listar diretórios
function listarDiretorios(diretorio) {
  try {
    return fs.readdirSync(diretorio, { withFileTypes: true })
      .filter(item => item.isDirectory())
      .map(item => item.name);
  } catch (err) {
    console.error("Erro ao listar diretórios:", err);
    return [];
  }
}

function listarArquivos(diretorio) {
  try {
    return fs.readdirSync(diretorio, { withFileTypes: true })
      .filter(item => item.isFile())
      .map(item => item.name);
  } catch (err) {
    console.error("Erro ao listar arquivos:", err);
    return [];
  }
}

// Funções para gerar breadcrumbs
function gerarBreadcrumbs(caminho) {
  if (!caminho) return [];
  
  const partes = caminho.split('/').filter(Boolean);
  return partes.map((parte, index) => {
    const caminhoAtual = partes.slice(0, index + 1).join('/');
    return {
      nome: parte,
      caminho: caminhoAtual
    };
  });
}

// Rota principal - bifurca entre versão completa (local) e simplificada (Vercel)
app.get('/', (req, res) => {
  if (isVercel) {
    // Versão simplificada para Vercel
    res.render('dashboard', {
      title: 'Gerenciador de Imagens',
      pastas: [],
      caminhoAtual: '',
      isVercel: true
    });
  } else {
    // Versão completa para ambiente local
    const pastas = listarDiretorios(STORAGE_DIR);
    res.render('dashboard_full', {
      title: 'Gerenciador de Imagens',
      pastas: pastas,
      caminhoAtual: '',
      isVercel: false
    });
  }
});

// Rota de navegação
app.get('/browse', (req, res) => {
  try {
    const caminho = req.query.path || '';
    const caminhoCompleto = path.join(STORAGE_DIR, caminho);
    
    if (!fs.existsSync(caminhoCompleto)) {
      return res.status(404).send('Pasta não encontrada');
    }
    
    if (isVercel) {
      // Versão simplificada para Vercel
      res.render('pasta', {
        pasta: path.basename(caminho) || 'Raiz',
        breadcrumbs: gerarBreadcrumbs(caminho),
        pastas: [],
        arquivos: [],
        caminhoAtual: caminho,
        isVercel: true
      });
    } else {
      // Versão completa para ambiente local
      const pastas = listarDiretorios(caminhoCompleto);
      const arquivos = listarArquivos(caminhoCompleto);
      
      res.render('pasta_full', {
        pasta: path.basename(caminho) || 'Raiz',
        breadcrumbs: gerarBreadcrumbs(caminho),
        pastas: pastas,
        arquivos: arquivos,
        caminhoAtual: caminho,
        isVercel: false
      });
    }
  } catch (err) {
    console.error("Erro ao navegar:", err);
    res.status(500).send('Erro ao navegar: ' + err.message);
  }
});

// Rota para criação de pasta
app.post('/pasta', (req, res) => {
  try {
    const { caminhoAtual, nomePasta } = req.body;
    
    if (!nomePasta) {
      return res.status(400).send('Nome da pasta não especificado');
    }
    
    // Criar caminho para a nova pasta
    const novaPasta = path.join(STORAGE_DIR, caminhoAtual || '', nomePasta);
    
    // Verificar se a pasta já existe
    if (fs.existsSync(novaPasta)) {
      return res.status(400).send('Esta pasta já existe');
    }
    
    // Criar a pasta
    fs.ensureDirSync(novaPasta);
    
    // Redirecionar
    if (caminhoAtual) {
      res.redirect('/browse?path=' + encodeURIComponent(caminhoAtual));
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error("Erro ao criar pasta:", err);
    res.status(500).send('Erro ao criar pasta: ' + err.message);
  }
});

// Rota para upload de arquivos
app.post('/upload', (req, res) => {
  upload.array('imagens', 20)(req, res, function(err) {
    if (err) {
      console.error("Erro no upload:", err);
      return res.status(500).send(`Erro no upload: ${err.message}`);
    }
    
    try {
      const { caminhoAtual = '' } = req.body;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).send('Nenhum arquivo enviado');
      }
      
      if (caminhoAtual) {
        res.redirect('/browse?path=' + encodeURIComponent(caminhoAtual));
      } else {
        res.redirect('/');
      }
    } catch (err) {
      console.error("Erro após upload:", err);
      res.status(500).send('Erro ao processar upload: ' + err.message);
    }
  });
});

// Diagnóstico
app.get('/info', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || 'development',
    vercel: isVercel,
    local: isLocal,
    tempDir: STORAGE_DIR,
    viewsDir: viewsPath,
    viewsExist: fs.existsSync(viewsPath),
    viewsFiles: fs.existsSync(viewsPath) ? fs.readdirSync(viewsPath) : [],
    currentDir: __dirname,
    parentDir: path.dirname(__dirname),
    rootDir: path.resolve('.')
  });
});

// Rota para exclusão de pasta
app.delete('/pasta', (req, res) => {
  try {
    const { caminhoAtual, pasta } = req.body;
    
    if (!pasta) {
      return res.status(400).send('Pasta não especificada');
    }
    
    // Caminho completo da pasta a ser excluída
    const caminhoPasta = path.join(STORAGE_DIR, caminhoAtual || '', pasta);
    
    // Verificar se a pasta existe
    if (!fs.existsSync(caminhoPasta)) {
      return res.status(404).send('Pasta não encontrada');
    }
    
    // Excluir a pasta e todo seu conteúdo
    fs.removeSync(caminhoPasta);
    
    // Redirecionar
    if (caminhoAtual) {
      res.redirect('/browse?path=' + encodeURIComponent(caminhoAtual));
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error("Erro ao excluir pasta:", err);
    res.status(500).send('Erro ao excluir pasta: ' + err.message);
  }
});

// Rota para exclusão de arquivo
app.delete('/arquivo', (req, res) => {
  try {
    const { caminhoAtual, arquivo } = req.body;
    
    if (!arquivo) {
      return res.status(400).send('Arquivo não especificado');
    }
    
    // Caminho completo do arquivo a ser excluído
    const caminhoArquivo = path.join(STORAGE_DIR, caminhoAtual || '', arquivo);
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(caminhoArquivo)) {
      return res.status(404).send('Arquivo não encontrado');
    }
    
    // Excluir o arquivo
    fs.unlinkSync(caminhoArquivo);
    
    // Redirecionar
    res.redirect('/browse?path=' + encodeURIComponent(caminhoAtual));
  } catch (err) {
    console.error("Erro ao excluir arquivo:", err);
    res.status(500).send('Erro ao excluir arquivo: ' + err.message);
  }
});

// Rota para renomear arquivo
app.put('/arquivo', (req, res) => {
  try {
    const { caminhoAtual, arquivoAtual, novoNome } = req.body;
    
    if (!arquivoAtual || !novoNome) {
      return res.status(400).send('Informações de renomeação incompletas');
    }
    
    // Caminho completo do arquivo atual
    const caminhoArquivoAtual = path.join(STORAGE_DIR, caminhoAtual || '', arquivoAtual);
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(caminhoArquivoAtual)) {
      return res.status(404).send('Arquivo não encontrado');
    }
    
    // Determinar a extensão e construir o novo nome
    const ext = path.extname(arquivoAtual);
    const novoNomeCompleto = novoNome + ext;
    
    // Caminho para o novo arquivo
    const caminhoArquivoNovo = path.join(STORAGE_DIR, caminhoAtual || '', novoNomeCompleto);
    
    // Verificar se já existe um arquivo com o novo nome
    if (fs.existsSync(caminhoArquivoNovo)) {
      return res.status(400).send('Já existe um arquivo com este nome');
    }
    
    // Renomear o arquivo
    fs.renameSync(caminhoArquivoAtual, caminhoArquivoNovo);
    
    // Redirecionar
    res.redirect('/browse?path=' + encodeURIComponent(caminhoAtual));
  } catch (err) {
    console.error("Erro ao renomear arquivo:", err);
    res.status(500).send('Erro ao renomear arquivo: ' + err.message);
  }
});

// Tratamento de erros 404
app.use((req, res) => {
  res.status(404).send('Página não encontrada');
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('Erro na aplicação:', err);
  res.status(500).send('Erro interno do servidor: ' + err.message); 
});

// Iniciar servidor para ambiente local
if (isLocal) {
  const PORT = process.env.PORT || 3010;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

module.exports = app; 
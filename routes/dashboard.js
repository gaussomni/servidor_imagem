const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    try {
      const pasta = req.body.caminhoAtual || '';
      console.log("Pasta de destino:", pasta);
      
      // Caminho completo da pasta de destino
      const destPath = path.join(__dirname, '../storage', pasta);
      console.log("Caminho completo de destino:", destPath);
      
      // Garantir que a pasta exista
      fs.ensureDirSync(destPath);
      console.log("Pasta de destino verificada/criada com sucesso");
      
      // Chamar o callback com o caminho de destino
      cb(null, destPath);
    } catch (err) {
      console.error("Erro ao configurar destino de upload:", err);
      cb(err);
    }
  },
  filename: function(req, file, cb) {
    try {
      // Extrair o nome original e a extensão
      const originalName = file.originalname;
      const ext = path.extname(originalName);
      const nameWithoutExt = path.basename(originalName, ext);
      
      console.log("Nome original:", originalName);
      
      // Obter o caminho da pasta atual
      const pasta = req.body.caminhoAtual || '';
      const destPath = path.join(__dirname, '../storage', pasta);
      
      // Verificar se já existe um arquivo com o mesmo nome
      const checkDuplicate = (baseName, extension, counter = 0) => {
        let fileName = counter === 0 
          ? `${baseName}${extension}` 
          : `${baseName}(${counter})${extension}`;
          
        const filePath = path.join(destPath, fileName);
        
        // Verificar se o arquivo existe de forma síncrona
        if (fs.existsSync(filePath)) {
          // Se existe, incrementa o contador e tenta novamente
          return checkDuplicate(baseName, extension, counter + 1);
        } else {
          // Se não existe, retorna o nome disponível
          return fileName;
        }
      };
      
      // Gerar um nome que não cause conflito
      const finalFileName = checkDuplicate(nameWithoutExt, ext);
      console.log("Nome final do arquivo:", finalFileName);
      
      cb(null, finalFileName);
    } catch (err) {
      console.error("Erro ao gerar nome do arquivo:", err);
      cb(err);
    }
  }
});

// Configurar limites e outras opções para o Multer
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: function(req, file, cb) {
    try {
      const filetypes = /jpeg|jpg|png|gif|webp/;
      const mimetype = filetypes.test(file.mimetype);
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
      
      console.log("MIME type:", file.mimetype);
      console.log("Extensão:", path.extname(file.originalname).toLowerCase());
      
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

// Função auxiliar para listar o conteúdo de uma pasta
async function listarConteudoPasta(caminho) {
  const caminhoCompleto = path.join(__dirname, '../storage', caminho);
  fs.ensureDirSync(caminhoCompleto);
  
  const itens = await fs.readdir(caminhoCompleto);
  
  const pastas = [];
  const arquivos = [];
  
  for (const item of itens) {
    const itemPath = path.join(caminhoCompleto, item);
    const itemStats = fs.statSync(itemPath);
    
    if (itemStats.isDirectory()) {
      pastas.push(item);
    } else {
      arquivos.push({
        nome: item,
        tamanho: Math.round(itemStats.size / 1024) + ' KB',
        data: itemStats.mtime.toLocaleDateString()
      });
    }
  }
  
  return { pastas, arquivos };
}

// Função para gerar breadcrumbs
function gerarBreadcrumbs(caminho) {
  if (!caminho) return [];
  
  const caminhoPartes = caminho.split(path.sep);
  let caminhoAcumulado = '';
  const breadcrumbs = [];
  
  for (let i = 0; i < caminhoPartes.length; i++) {
    if (!caminhoPartes[i]) continue;
    
    caminhoAcumulado = caminhoAcumulado ? 
      path.join(caminhoAcumulado, caminhoPartes[i]) : 
      caminhoPartes[i];
      
    breadcrumbs.push({
      nome: caminhoPartes[i],
      caminho: caminhoAcumulado
    });
  }
  
  return breadcrumbs;
}

// Rota principal - Lista todas as pastas
router.get('/', async (req, res) => {
  try {
    const { pastas } = await listarConteudoPasta('');
    
    res.render('dashboard', { 
      pastas: pastas,
      caminhoAtual: '',
      breadcrumbs: []
    });
  } catch (err) {
    console.error('Erro na rota principal:', err);
    res.status(500).send('Erro ao listar pastas: ' + err.message);
  }
});

// Rota para visualizar conteúdo de uma pasta
router.get('/browse', async (req, res) => {
  try {
    const caminho = req.query.path || '';
    console.log('Acessando pasta:', caminho);
    
    const { pastas, arquivos } = await listarConteudoPasta(caminho);
    const breadcrumbs = gerarBreadcrumbs(caminho);
    
    res.render('pasta', { 
      pasta: path.basename(caminho) || 'root',
      arquivos,
      pastas,
      caminhoAtual: caminho,
      breadcrumbs
    });
  } catch (err) {
    console.error('Erro ao acessar pasta:', err);
    res.status(500).send('Erro ao listar o conteúdo da pasta: ' + err.message);
  }
});

// Criar pasta
router.post('/pasta', async (req, res) => {
  try {
    const { nomePasta, caminhoAtual = '' } = req.body;
    console.log('Criando pasta:', nomePasta, 'em:', caminhoAtual);
    
    if (!nomePasta) {
      return res.status(400).send('Nome da pasta é obrigatório');
    }
    
    // Sanitizar caminho para evitar problemas de segurança
    const caminhoSanitizado = caminhoAtual.replace(/\.\./g, '');
    
    const pastaPath = path.join(__dirname, '../storage', caminhoSanitizado, nomePasta);
    await fs.ensureDir(pastaPath);
    
    if (caminhoSanitizado) {
      res.redirect('/browse?path=' + encodeURIComponent(caminhoSanitizado));
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error('Erro ao criar pasta:', err);
    res.status(500).send('Erro ao criar pasta: ' + err.message);
  }
});

// Modificar rota de upload para suportar múltiplos arquivos
router.post('/upload', function(req, res) {
  console.log("Iniciando upload de múltiplos arquivos...");
  
  // Usar multer.array para processar múltiplos arquivos com o nome 'imagens'
  upload.array('imagens', 20)(req, res, function(err) {
    console.log("Processando upload...");
    
    if (err) {
      console.error("Erro no processamento do upload:", err);
      if (err instanceof multer.MulterError) {
        // Erro do Multer
        return res.status(500).send(`Erro no upload: ${err.message}`);
      } else {
        // Outro erro
        return res.status(500).send(`Erro no servidor: ${err.message}`);
      }
    }
    
    // Se chegou aqui, não houve erro no upload
    try {
      const { caminhoAtual = '' } = req.body;
      console.log("Upload concluído em:", caminhoAtual);
      console.log("Arquivos recebidos:", req.files ? req.files.length : 0);
      
      if (!req.files || req.files.length === 0) {
        console.error("Nenhum arquivo recebido");
        return res.status(400).send('Nenhum arquivo enviado');
      }
      
      // Redirecionar de volta para a pasta
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

// Excluir arquivo
router.delete('/arquivo', async (req, res) => {
  try {
    const { caminhoAtual = '', arquivo } = req.body;
    console.log('Excluindo arquivo:', arquivo, 'em:', caminhoAtual);
    
    if (!arquivo) {
      return res.status(400).send('Nome do arquivo é obrigatório');
    }
    
    const caminho = path.join(__dirname, '../storage', caminhoAtual, arquivo);
    
    await fs.remove(caminho);
    
    if (caminhoAtual) {
      res.redirect('/browse?path=' + encodeURIComponent(caminhoAtual));
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error('Erro ao excluir arquivo:', err);
    res.status(500).send('Erro ao excluir arquivo: ' + err.message);
  }
});

// Renomear arquivo
router.put('/arquivo', async (req, res) => {
  try {
    const { caminhoAtual = '', arquivo, novoNome } = req.body;
    console.log('Renomeando arquivo:', arquivo, 'para:', novoNome, 'em:', caminhoAtual);
    
    if (!arquivo || !novoNome) {
      return res.status(400).send('Nome do arquivo e novo nome são obrigatórios');
    }
    
    const ext = path.extname(arquivo);
    const novoNomeComExt = novoNome.includes('.') ? novoNome : novoNome + ext;
    
    const caminhoAntigo = path.join(__dirname, '../storage', caminhoAtual, arquivo);
    const caminhoNovo = path.join(__dirname, '../storage', caminhoAtual, novoNomeComExt);
    
    await fs.rename(caminhoAntigo, caminhoNovo);
    
    if (caminhoAtual) {
      res.redirect('/browse?path=' + encodeURIComponent(caminhoAtual));
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error('Erro ao renomear arquivo:', err);
    res.status(500).send('Erro ao renomear arquivo: ' + err.message);
  }
});

// Excluir pasta
router.delete('/pasta', async (req, res) => {
  try {
    const { caminhoAtual = '', pasta } = req.body;
    console.log('Excluindo pasta:', pasta, 'em:', caminhoAtual);
    
    if (!pasta) {
      return res.status(400).send('Nome da pasta é obrigatório');
    }
    
    // Caminho completo da pasta a ser removida
    const caminhoPasta = path.join(__dirname, '../storage', caminhoAtual, pasta);
    
    await fs.remove(caminhoPasta);
    
    // Redirecionar para a pasta pai
    if (caminhoAtual) {
      res.redirect('/browse?path=' + encodeURIComponent(caminhoAtual));
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error('Erro ao excluir pasta:', err);
    res.status(500).send('Erro ao excluir pasta: ' + err.message);
  }
});

module.exports = router; 
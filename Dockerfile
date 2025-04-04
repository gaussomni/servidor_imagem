FROM node:18-alpine

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de configuração
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar código-fonte
COPY . .

# Criar diretório de armazenamento
RUN mkdir -p storage && chmod 777 storage

# Expor porta
EXPOSE 3010

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3010

# Comando para executar a aplicação
CMD ["node", "api/index.js"] 
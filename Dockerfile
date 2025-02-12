# Usar a imagem oficial do Node.js
FROM node:20

# Definir diretório de trabalho dentro do contêiner
WORKDIR /app

# Copiar os arquivos necessários para o contêiner
COPY package.json package-lock.json ./

# Instalar as dependências
RUN npm install

# Copiar o restante do código para dentro do contêiner
COPY . .

# Expor a porta do servidor
EXPOSE 3001

# Comando para iniciar o servidor
CMD ["npm", "run", "dev"]

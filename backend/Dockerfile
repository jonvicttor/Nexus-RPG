FROM node:18-alpine

WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código
COPY . .

# Compila o código TypeScript
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
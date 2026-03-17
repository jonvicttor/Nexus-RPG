FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
# Adicione esta linha abaixo para garantir:
RUN npm install -g ts-node typescript 
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]
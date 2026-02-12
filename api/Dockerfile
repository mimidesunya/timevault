FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

# Create data directory
RUN mkdir -p /data/uploads/meta

EXPOSE 3001
CMD ["node", "server.js"]

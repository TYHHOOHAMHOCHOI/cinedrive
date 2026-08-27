FROM node:18-alpine

# Cài đặt FFmpeg trên Alpine Linux
RUN apk add --no-gradient --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3001

CMD ["node", "index.js"]

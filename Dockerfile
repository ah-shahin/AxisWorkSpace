FROM node:20-alpine

WORKDIR /app

# Install and build the React frontend
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client ./client
RUN cd client && npm run build

# Install backend dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

COPY server ./server

WORKDIR /app/server

EXPOSE 8080

CMD ["node", "server.js"]

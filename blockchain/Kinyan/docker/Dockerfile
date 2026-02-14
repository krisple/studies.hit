FROM node:20-bullseye

WORKDIR /app

# Install deps with good layer caching
COPY package.json package-lock.json ./
RUN npm ci

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend

# Copy the rest of the repo
COPY . .

RUN chmod +x docker/start.sh

EXPOSE 8545 8787 5173

CMD ["bash", "docker/start.sh"]

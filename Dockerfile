FROM node:18-alpine

WORKDIR /app

# Copy package manifests first for efficient caching
COPY package.json package-lock.json ./

# Install all dependencies (including dev) so Vite is available
RUN npm ci

# Copy the rest of the source
COPY . .

# Vite default port
EXPOSE 5173

# Ensure Vite binds to all interfaces
ENV HOST 0.0.0.0

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

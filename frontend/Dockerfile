# Use Node.js to serve the application
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (if any)
RUN npm install --production

# Copy application files
COPY . .

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]

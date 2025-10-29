# Use the official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for caching layers)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of your project
COPY . .

# Expose port (adjust to your app’s port)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]

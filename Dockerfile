FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose port for Express (Railway)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

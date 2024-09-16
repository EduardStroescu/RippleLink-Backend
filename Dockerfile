# Dockerfile for NestJS Backend

# Stage 1: Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy only the package.json and package-lock.json to leverage Docker's caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy the built files from the previous stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/client ./client
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Expose the port
EXPOSE 3000


# Start the application
CMD ["npm", "run", "start:prod"]

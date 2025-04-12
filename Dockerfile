# Dockerfile for NestJS Backend

# Stage 1: Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy only the package.json and package-lock.json to leverage Docker's caching
COPY package*.json ./

# Install dependencies
RUN npm ci

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
COPY --from=build /app/package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Expose the port
EXPOSE 3000


# Start the application
CMD ["npm", "run", "start:prod"]

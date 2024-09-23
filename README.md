<p align="center">
  <a href="https://ripple-link.vercel.app" target="blank"><img src="https://raw.githubusercontent.com/EduardStroescu/PubImages/main/WebsiteImages/rippleLink.jpg" alt="RippleLink Preview" /></a>
</p>

# RippleLink Backend

### Links to the Frontend:

https://github.com/EduardStroescu/RippleLink-Frontend - Github Repo
https://ripple-link.vercel.app - Live Demo

### Links to backend main page and swagger documentation:

https://ripple-link.koyeb.app - Live Demo
https://ripple-link.koyeb.app/api/docs - Swagger Documentation

# Introduction

Full-Stack live calls and messaging service using SocketIO, WebRTC and NestJS with MongoDB and Cloudinary for File uploads.

## Technologies Used

- [nestjs](https://nestjs.com/) - API Management
- [socket.io](https://socket.io/) - Realtime Communication
- [ioredis](https://github.com/redis/ioredis) - Redis Cache
- [@nestjs-modules/ioredis](https://github.com/nest-modules/ioredis) - Ioredis Adapter for NestJS
- [mongodb](https://www.mongodb.com/) - Database
- [mongoose](https://mongoosejs.com/) - ORM for database management
- [passport](https://www.passportjs.org/) - Authentication
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Password Encryption
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) - JWT Authentication
- [cloudinary](https://github.com/cloudinary/cloudinary_npm) - File Uploads
- [docker](https://www.docker.com/) - Image creation for production
- [dotenv](https://github.com/motdotla/dotenv) - Environment Variables
- [swagger](https://swagger.io/) - Documentation

## Description

The RippleLink backend is built using NestJS and MongoDB w/ Mongoose and uses Redis from a Docker instance for caching. Cloudinary is used for File Uploads. Authentication is done through passport with JWT tokens. Also used as a WebRTC signaling server.

## Installation

```bash
$ npm install
```

## Setup Environment Variables

### Create a .env file in the root directory and add the following variables:

```bash

# The port to run the server on, defaults to 3000.

PORT=

# The client url tied to the backend.

CLIENT_URL=

# The database url tied to the backend. Obtained from MongoDB.

MONGODB_URI=

# JWT secrets for authentication.

ACCESS_SECRET=
REFRESH_SECRET=

# Cloudinary credentials for avatar uploads. See https://cloudinary.com/.

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Redis credentials.

REDIS_URL=redis://localhost:6379 for Dev or redis://:<PASSWORD>redis:6379 for Prod.
REDIS_PASSWORD=""

# Credentials for the admin user to reset redis cache if needed. Not needed to be added to the database at all.

ADMIN_ID=""
ADMIN_PASSWORD=""

```

## Running the app

Running a Redis instance is required for the app to run. The instance can be run locally (natively or using Docker) or remotely.

```bash

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Building for Production

The following are the manual steps to build the image for production, but I've also included a github action that will build and push the image to DockerHub.

```bash

# build docker image from Dockerfile
docker build -t {{username}}/ripple-link:latest . --no-cache

# push to DockerHub
docker push {{username}}/ripple-link:latest

push repo to GitHub

deploy to e.g. Koyeb from github repo - requires Dockerfile.koyeb for Koyeb to use docker-compose for the build stage. Expose port 3000 on path "/" and health checks on path "/api/health" - port 3000.

```

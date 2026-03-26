# Social App Backend (GraphQL API) 

A robust, highly scalable, and secure GraphQL backend designed for a modern social media application. Built with Node.js, Apollo Server, Express, and TypeScript, this architecture heavily emphasizes decoupling, security, and real-time capabilities.

## 🌟 Key Features

* **Advanced GraphQL API:** Fully typed and documented API using Apollo Server v4.
* **Secure File Uploads (S3/MinIO):** Custom multipart upload implementation using `graphql-upload-ts` and `@aws-sdk/client-s3`.
* **Zero-Trust Storage Security:** Implementation of **Pre-signed URLs** for media access, ensuring that private files (like chat images) remain completely secure and are only accessible via temporary, server-signed tokens.
* **Real-time Subscriptions:** WebSockets integration (`graphql-ws`) for instant chat delivery and live feed updates.
* **High-Performance Caching:** Redis integration for caching user feeds and optimizing database hits.
* **Modular Architecture:** Clean separation of concerns using the "Loader" pattern (Express, Apollo, Database, Redis, and Storage are initialized independently).
* **Authentication & Authorization:** JWT-based authentication with role-based access control.

## 🛠️ Tech Stack

* **Core:** Node.js, Express, TypeScript
* **API:** Apollo Server v4, GraphQL, GraphQL Subscriptions
* **Database:** MongoDB (Mongoose)
* **Caching & Pub/Sub:** Redis (`ioredis`)
* **Storage:** AWS SDK v3, MinIO (S3 Compatible)
* **Security:** bcrypt, jsonwebtoken, CORS

## 📂 Project Structure

The project follows a clean, domain-driven structure:

```text
src/
├── auth/           # Authentication context and JWT verification
├── config/         # Environment variables and global configurations
├── graphql/        # GraphQL TypeDefs, Resolvers, and Schema generation
├── Loaders/        # Initialization modules (Apollo, Express, MongoDB, Redis, S3, WebSockets)
├── models/         # Mongoose database schemas (User, Post, Message, etc.)
├── services/       # Core business logic and reusable services
├── subscriptions/  # PubSub events and WebSocket logic
├── types/          # TypeScript interfaces and global types
├── uploads/        # File streaming, validation, and S3 business logic
├── utils/          # Helper functions (e.g., S3 pre-signed URL generators)
└── index.ts        # Application entry point
````

## 🚀 Getting Started

### Prerequisites

  * Node.js (v18+ recommended)
  * MongoDB instance
  * Redis server
  * MinIO / AWS S3 bucket

### Environment Variables

Create a `.env` file in the root directory and configure the following:

```env
PORT=4000
NODE_ENV=development

# Database & Caching
MONGO_URI=mongodb://localhost:27017/social_app
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_super_secret_key

# MinIO / S3 Storage
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_BUCKET_NAME=social-media-uploads
REGION=us-east-1
```

### Installation

1.  Install dependencies:

    ```bash
    npm install
    ```

2.  Start the development server:

    ```bash
    npm run dev
    ```

3.  Build for production:

    ```bash
    npm run build
    npm start
    ```

## 📡 GraphQL Endpoints

Once the server is running, access the Apollo Sandbox at:
`http://localhost:4000/graphql`

*Note for File Uploads via Sandbox:* Ensure you map your variables correctly and enable the "Set protocol to multi-file" toggle in Apollo Sandbox to test `Upload` scalars.

## 👨‍💻 Author

**Abdelrhman Muhamed** Full-Stack Developer | [apdo978](https://www.google.com/search?q=https://github.com/apdo978)

```

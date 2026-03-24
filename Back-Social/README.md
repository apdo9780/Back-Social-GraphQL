# Back-Social Documentation

Back-Social is the TypeScript + Express API and Socket.IO server for the social platform. It provides authentication, posts, friends, chats, and messaging APIs, plus real-time events.

## Tech Stack

- Node.js + Express 5
- TypeScript
- MongoDB + Mongoose
- JWT authentication
- Socket.IO
- Multer for uploads
- express-validator for request validation

## Project Structure

```text
src/
  config/         # Database connection
  controllers/    # Route handlers and business logic
  middlewares/    # Auth, validation, upload, error handling
  models/         # Mongoose schemas/interfaces
  routes/         # Route definitions
  services/       # Socket service and context
  validators/     # Validation chains
uploads/
  avatars/
  posts/
```

## API Base Prefix

All routes are mounted under:

```text
/api/${API_VERSION || 'v1'}
```

Examples with default version:

- `/api/v1/auth/login`
- `/api/v1/posts`
- `/api/v1/health`

## Environment Variables

Create a `.env` file in `Back-Social`.

```env
PORT=3000
API_VERSION=v1
MONGODB_URI=mongodb://localhost:27017/socialapp
JWT_SECRET=replace_with_strong_secret
CLIENT_URL=http://localhost:4200
```

Notes:

- `MONGODB_URI` falls back to `mongodb://localhost:27017/socialapp` if missing.
- `PORT` defaults to `3000`.
- CORS and Socket.IO origin use `CLIENT_URL` (fallback `http://localhost:4200`).

## Running the Backend

```bash
cd Back-Social
npm install
npm start
```

Current start script:

```json
"start": "npx tsc && nodemon ./dist/index.js"
```

## Health Check

```http
GET /api/v1/health
```

Response includes status, version, and timestamp.

## REST Endpoints

### Auth routes

Base: `/api/v1/auth`

- `POST /register`
- `POST /login`
- `GET /me` (protected)
- `GET /search` (protected)
- `GET /friend/:friendId` (protected)
- `PUT /updatedetails` (protected)
- `PUT /avatar` (protected, multipart `avatar`)

### Post routes

Base: `/api/v1/posts`

- `GET /` (protected)
- `POST /` (protected, multipart optional `image`)
- `GET /mine` (protected)
- `GET /user/:userId` (protected)
- `GET /:id` (protected)
- `PUT /:id` (protected, multipart optional `image`)
- `DELETE /:id` (protected)
- `PUT /:id/like` (protected)
- `POST /:id/comments` (protected)

### Chat routes

Base: `/api/v1/chats`

- `GET /` (protected)
- `POST /` (protected direct chat access/create)
- `POST /group` (protected)
- `PUT /group/:chatId` (protected rename)
- `PUT /group/:chatId/add` (protected)
- `PUT /group/:chatId/remove` (protected)

### Message routes

Base: `/api/v1/messages`

- `GET /:chatId` (protected)
- `POST /` (protected send message)
- `PUT /:chatId/read` (protected)

### Friend routes

Base: `/api/v1/friends`

- `POST /request/:userId` (protected)
- `PUT /accept/:requestId` (protected)
- `PUT /reject/:requestId` (protected)
- `GET /requests` (protected)
- `GET /` (protected)
- `DELETE /:friendId` (protected)

## Socket.IO

### Authentication

Client must provide token in handshake auth payload:

```ts
auth: { token: 'jwt_token' }
```

### Server-emitted events

- `new_message`
- `message_delivered`
- `new_friend_request`
- `friend_request_response`
- `user_status_changed`
- `typing_started`
- `typing_stopped`
- `user_joined`
- `user_left`

### Client-to-server events

- `join_chat`
- `leave_chat`
- `new_message`
- `typing_status`
- `friend_request`
- `friend_request_response`
- `set_status`

## Uploads

Static files are exposed from:

```text
/uploads
```

Mapped to local `uploads` directory containing `avatars` and `posts`.

## Error Handling

- Unknown routes produce 404 and flow to centralized error middleware.
- Validation errors are handled through validator chains + `validate` middleware.

## Testing

No dedicated backend test script is currently defined in `package.json`.

Recommended manual checks:

1. Health endpoint.
2. Register/login/token usage.
3. Protected route access with/without token.
4. Post create with image upload.
5. Socket connect + chat/friend events.

## Troubleshooting

### Frontend cannot reach backend

- Confirm backend port and frontend `apiBaseUrl` match.
- Default mismatch can occur (`3000` backend vs `5000` frontend env).

### Socket authentication error

- Verify `JWT_SECRET` is set and consistent for token verification.
- Ensure frontend sends the token in handshake auth.

### Uploads return missing files

- Confirm `uploads` directories exist and app has write permissions.

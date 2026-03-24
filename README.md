# Social App Monorepo

This repository contains a full-stack social platform:

- Angular frontend application
- Node.js/Express backend API
- Socket.IO real-time layer
- MongoDB persistence

## Repository Layout

```text
Angular Front end/   # Frontend app (Angular)
Back-Social/         # Backend app (Express + TypeScript + MongoDB + Socket.IO)
uploads/             # Uploaded avatars/posts served by backend
```

## Documentation Index

- Frontend docs: `Angular Front end/README.md`
- Backend docs: `Back-Social/README.md`

## Quick Start

### 1) Start backend

```bash
cd Back-Social
npm install
npm start
```

### 2) Start frontend

Open a second terminal:

```bash
cd "Angular Front end"
npm install
npm start
```

### 3) Open app

```text
http://localhost:4200
```

## Configuration

### Backend env file (`Back-Social/.env`)

```env
PORT=3000
API_VERSION=v1
MONGODB_URI=mongodb://localhost:27017/socialapp
JWT_SECRET=replace_with_strong_secret
CLIENT_URL=http://localhost:4200
```

### Frontend environment

`Angular Front end/src/environments/environment.development.ts` currently points to:

```ts
apiBaseUrl: 'http://localhost:5000/api/v1'
```

If backend runs on `3000` (default), update frontend to:

```ts
apiBaseUrl: 'http://localhost:3000/api/v1'
```

## Integration Notes

- Backend CORS and socket origin are controlled by `CLIENT_URL`.
- Frontend auth stores token in local storage and uses it for HTTP + socket auth.
- Notification system includes real-time toasts, unread tracking, and audible notification cues.

## Build and Test

### Frontend

```bash
cd "Angular Front end"
npm run build
npm test
```

### Backend

```bash
cd Back-Social
npm start
```

Backend currently has no dedicated test script.

## Core Features

- JWT authentication (register/login/profile)
- Post feed with likes/comments and media uploads
- Friend requests and friend list management
- Direct/group chats and messaging
- Presence/status updates and real-time notifications

## Recommended Development Workflow

1. Start MongoDB first.
2. Start backend and verify health endpoint.
3. Start frontend.
4. Register two users for chat/friend testing.
5. Validate socket events and notification flow.

## Health Endpoint

When backend runs with default settings:

```http
GET http://localhost:3000/api/v1/health
```

## Common Issues

### API requests fail

- Check API base URL in frontend environment.
- Check backend running port and API version.

### Socket connection fails

- Check token exists after login.
- Check backend `CLIENT_URL` allows frontend origin.

### Notifications appear without sound

- Browser may block sound until user interaction.
- Click once in app and trigger a new notification.

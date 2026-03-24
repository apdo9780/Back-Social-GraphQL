# Angular Front End Documentation

This app is the Angular client for the social platform. It handles authentication, feed/posts, friends, chat, profile management, and real-time notifications over Socket.IO.

## Tech Stack

- Angular 21 (standalone components)
- TypeScript
- RxJS
- Socket.IO client
- TailwindCSS + SCSS
- Vitest for unit testing

## Project Structure

```text
src/
	app/
		Componants/          # Feature UI screens (existing folder spelling kept intentionally)
		Interceptors/        # HTTP interceptors (auth, loading)
		Services/
			api/               # REST API wrappers by domain
			auth/              # Auth logic and guards
			socket/            # Socket and notifications services
			theme/             # Theme handling
		shared/
			models/            # Shared frontend request/response/domain types
	environments/          # Environment-specific runtime config
```

## Routing

Configured in `src/app/app.routes.ts`.

- Protected with `authGuard` under main layout:
	- `/` Home
	- `/friends`
	- `/chats`
	- `/posts`
	- `/settings`
	- `/users/:id`
- Guest-only routes:
	- `/login`
	- `/register`
- Fallback: `**` redirects to `/`

## Environment Configuration

Configured in:

- `src/environments/environment.development.ts`
- `src/environments/environment.ts`

Current API base URL:

```ts
apiBaseUrl: 'http://localhost:5000/api/v1'
```

Important: the backend defaults to port `3000`. If you run backend on `3000`, update frontend `apiBaseUrl` to `http://localhost:3000/api/v1`.

## Main Services

### API layer

- `Services/api/api.service.ts`
	- Generic `get/post/put/delete` wrapper over Angular `HttpClient`
	- Prepends `environment.apiBaseUrl`

### Auth

- `Services/auth/auth.service.ts`
	- `login`, `register`, `me`, `searchUsers`, `getFriendProfile`, `updateDetails`, `uploadAvatar`
	- Stores JWT in `localStorage` key: `social_app_token`

### Posts

- `Services/api/posts.service.ts`
	- Feed, own posts, user posts
	- Create/update with `FormData` (`content`, `privacy`, `tags`, optional `image`)
	- Like and comment operations

### Friends

- `Services/api/friends.service.ts`
	- Get requests and friends
	- Send/accept/reject/remove
	- Emits socket events for friend request responses

### Chats

- `Services/api/chats.service.ts`
	- Get chats, access direct chat
	- Get messages, send message, mark as read

### Realtime Socket

- `Services/socket/socket.service.ts`
	- Connects using token from auth service
	- Uses backend origin from `apiBaseUrl`
	- Transport fallback: websocket + polling

### Notifications

- `Services/socket/notifications.service.ts`
	- Stores notification history and transient toasts
	- Tracks unread counts per chat
	- Tracks pending friend requests and presence
	- Handles `new_friend_request`, `friend_request_response`, `new_chat`, `new_message`, `post_interaction`, legacy post events, and `user_status_changed`
	- Plays a short sound on each pushed notification

## Running the Frontend

```bash
cd "Angular Front end"
npm install
npm start
```

Dev server default:

```text
http://localhost:4200
```

## Build

```bash
cd "Angular Front end"
npm run build
```

## Test

```bash
cd "Angular Front end"
npm test
```

## Integration Checklist

1. Backend is running and reachable.
2. Frontend `apiBaseUrl` matches backend host/port and API version.
3. Backend CORS `CLIENT_URL` allows frontend origin.
4. JWT token exists in local storage after login.
5. Socket connection succeeds after authentication.

## Troubleshooting

### API requests fail with CORS errors

- Verify backend `CLIENT_URL` environment variable.
- Verify frontend URL (`http://localhost:4200`) is allowed.

### Login works but sockets do not connect

- Confirm token exists in local storage.
- Confirm backend socket server is running and same origin as API host.

### Notifications arrive but no sound

- Browser may block autoplay until first user interaction.
- Click once inside the app, then trigger a new notification.

## Notes for Contributors

- Preserve existing folder naming/casing (`Componants`).
- Keep explicit TypeScript types when adding/changing service APIs.
- Source API/socket URLs from environment files, not hardcoded component values.

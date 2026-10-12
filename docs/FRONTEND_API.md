# Kingdom of Chess API: Frontend Guide

This guide describes the HTTP API for frontend integration. Swagger UI is also
available at `GET /api/docs` when the backend is running.

## Base URL and headers

Set the API origin per environment, for example:

```text
Development: http://localhost:3000
Production:  https://<your-api-host>
```

For browser requests from a different origin, configure the backend's
`CORS_ORIGINS` environment variable as a comma-separated list of exact frontend
origins, including the scheme and port when applicable. For example:

```text
CORS_ORIGINS=http://localhost:5173,https://chess.example.com
```

The development default allows `http://localhost:3000` and
`http://localhost:5173`. Set the production frontend origin explicitly when
deploying. The browser's `strict-origin-when-cross-origin` referrer policy is
normal and does not itself indicate a CORS failure.

All application routes use the `/api` prefix. Send JSON request bodies with:

```http
Content-Type: application/json
```

For protected routes, send the access token returned by register/login/refresh:

```http
Authorization: Bearer <accessToken>
```

## Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Register as a player and receive tokens |
| `POST` | `/api/auth/login` | No | Sign in and receive tokens |
| `POST` | `/api/auth/refresh` | No | Rotate tokens using the refresh token |
| `POST` | `/api/auth/logout` | Bearer | Revoke the current refresh-token session |
| `GET` | `/api/auth/profile` | Bearer | Get the identity from the access token |

### Register

```json
{
  "name": "Avery Player",
  "email": "avery@example.com",
  "password": "StrongPass123!"
}
```

Registration does not accept a role. New accounts are assigned `player` and
start with a rating of 1200.

### Login and token response

Login body:

```json
{
  "email": "avery@example.com",
  "password": "StrongPass123!"
}
```

Register, login, and refresh return:

```json
{
  "accessToken": "<JWT>",
  "refreshToken": "<JWT>",
  "tokenType": "Bearer",
  "expiresIn": "15m"
}
```

Refresh body:

```json
{
  "refreshToken": "<current-refresh-token>"
}
```

Refresh rotates both tokens; replace the stored access and refresh tokens with
the returned values. Logout returns:

```json
{ "message": "Logged out successfully" }
```

`GET /api/auth/profile` returns the authenticated token identity, currently
including `userId`, `email`, and `role`. A role change takes effect in newly
issued tokens; refresh or sign in again to obtain an updated role claim.

## Roles and access

Roles are `player`, `coach`, and `admin`.

- Admin-only: user administration (`GET/POST /api/users`,
  `GET/PATCH/DELETE /api/users/:id`).
- Coach/admin: create, update, and delete matches; inspect all matchmaking
  queue entries.
- Authenticated: profile, matches, tournaments, and matchmaking routes unless
  an endpoint below is explicitly described as public.
- Public: `GET /api/leaderboard` and `GET /api/leaderboard/:userId`.

## Pagination, search, and sorting

Paginated list APIs return an object in this form:

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

The user, match, matchmaking, and tournament list endpoints return the full
metadata shape above. Leaderboard pagination returns `total`, `page`, `limit`,
and `totalPages` (it does not include the `hasNextPage` flags). The available
parameters and defaults vary by list. Use only the documented `sortBy` values;
unsupported values are rejected by request validation. Example:

```text
GET /api/matches?page=2&limit=20&search=completed&sortBy=createdAt&sortOrder=DESC
```

## Users

All user endpoints require a bearer token.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/users` | Admin | Create a user |
| `GET` | `/api/users` | Admin | Paginated user list |
| `GET` | `/api/users/me` | Authenticated | Get own profile |
| `PATCH` | `/api/users/me` | Authenticated | Update own name/email |
| `GET` | `/api/users/me/matches` | Authenticated | List own matches |
| `GET` | `/api/users/me/schedule` | Authenticated | List own tournament registrations |
| `GET` | `/api/users/:id` | Admin | Get one user |
| `PATCH` | `/api/users/:id` | Admin | Update name/email/password/role |
| `DELETE` | `/api/users/:id` | Admin | Delete a user |

User creation body:

```json
{
  "name": "Avery Player",
  "email": "avery@example.com",
  "password": "StrongPass123!",
  "role": "player"
}
```

For admin-created accounts `role` is optional and defaults to `player`. Accepted
roles are `player`, `coach`, and `admin`. Passwords are hashed and never returned.
The admin list accepts:

| Query | Default | Description |
| --- | --- | --- |
| `page` | `1` | 1-based page |
| `limit` | `10` | Page size, maximum `100` |
| `search` | — | Case-insensitive search in name, email, or role |
| `sortBy` | `createdAt` | `name`, `email`, `role`, `rating`, `createdAt`, `updatedAt` |
| `sortOrder` | `DESC` | `ASC` or `DESC` |

Profile update body accepts only `name` and/or `email`; users cannot change their
own role or rating. Admin updates accept any subset of `name`, `email`,
`password`, and `role`. An admin cannot remove/demote the last admin or delete
their own account.

Example profile:

```json
{
  "id": "b6ef4a16-78e2-4b73-a7cc-c778c6bc5ab9",
  "name": "Avery Player",
  "email": "avery@example.com",
  "role": "player",
  "rating": 1200,
  "createdAt": "2026-10-12T10:00:00.000Z",
  "updatedAt": "2026-10-12T10:00:00.000Z"
}
```

## Matches

All match endpoints require a bearer token. Match creation, update, and deletion
are restricted to coaches and admins; any authenticated user can list/read them.
Tournament games are paired automatically and cannot be created or reassigned
through these routes.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/matches` | Coach/admin | Create a match |
| `GET` | `/api/matches` | Authenticated | Paginated match list |
| `GET` | `/api/matches/me` | Authenticated | Paginated match history for the signed-in player |
| `GET` | `/api/matches/:id` | Authenticated | Get one match |
| `GET` | `/api/matches/:id/game` | Player in match | Get FEN, turn, and legal moves |
| `POST` | `/api/matches/:id/moves` | Player in match | Submit a chess move |
| `PATCH` | `/api/matches/:id` | Coach/admin | Update match |
| `DELETE` | `/api/matches/:id` | Coach/admin | Delete match |

Create body:

```json
{
  "whitePlayerId": "b6ef4a16-78e2-4b73-a7cc-c778c6bc5ab9",
  "blackPlayerId": "bf2a43ce-d151-45f1-a11f-54a236cdf7c8",
  "status": "scheduled",
  "pgn": null
}
```

Statuses: `scheduled`, `in_progress`, `completed`, `cancelled`. Results:
`white_win`, `black_win`, `draw`. A completed match must have a result; a result
is allowed only on a completed match. Supplying `result` together with
`"status": "completed"` records the result and recalculates player Elo ratings.
`pgn` is an optional string. A match cannot be played against the same user.

The list supports `page` (default `1`), `limit` (default `10`, max `100`),
`search` (match ID, player IDs, tournament ID, status, or result), `sortBy`
(`createdAt`, `updatedAt`, `completedAt`, `status`, `result`, `whitePlayerId`,
`blackPlayerId`), and `sortOrder` (`ASC` or `DESC`, default `DESC`). Optional
filters: `status`, `result`, and `tournamentId`.

The game-state endpoint returns `{ match, fen, turn, playerColor, legalMoves }`.
Submit a move as `{ "from": "e2", "to": "e4" }`; add `"promotion": "q"`,
`"r"`, `"b"`, or `"n"` when promoting. Moves are validated against the current
board and turn. The server updates the PGN, completes games when the chess
rules determine an outcome, and recalculates ratings. A player can only read or
play a match they are a participant in.

## Matchmaking

All matchmaking endpoints require a bearer token.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/matchmaking` | Authenticated | Join the queue and attempt a pairing |
| `GET` | `/api/matchmaking/me` | Authenticated | Get own latest queue entry |
| `DELETE` | `/api/matchmaking/me` | Authenticated | Leave own waiting queue entry |
| `GET` | `/api/matchmaking` | Coach/admin | Paginated queue list |
| `GET` | `/api/matchmaking/:id` | Owner or coach/admin | Get one queue entry |
| `DELETE` | `/api/matchmaking/:id` | Owner or coach/admin | Delete an unmatched queue entry |

The join endpoint is for player accounts only and has no request body; it uses
the authenticated user's rating. A player with a scheduled or in-progress match
must finish it before entering the queue again.
It returns a `queueEntry` and either the newly created `match` or `null` while
waiting:

```json
{
  "queueEntry": {
    "id": "0f15fbc0-6617-4532-b649-9f6b8bd8f7a0",
    "userId": "b6ef4a16-78e2-4b73-a7cc-c778c6bc5ab9",
    "rating": 1200,
    "status": "waiting",
    "matchId": null
  },
  "match": null
}
```

New pairings create an `in_progress` match. When a pairing is created, both
players receive a `match-found` Socket.IO event containing `{ matchId, match }`
after the transaction commits. When either player submits a move, both receive
`game-updated` with `{ matchId }` and can reload the game-state endpoint. Connect
to the API origin using Socket.IO with the access token in
`auth: { token: accessToken }`; invalid or expired tokens are disconnected.
Socket.IO uses the same allowed origins as HTTP CORS.

The queue selects the closest eligible rating. Its acceptable gap starts at
100 points, expands by 50 points per minute, and caps at 800 points. Queue list
parameters: `page` (default `1`), `limit` (default `10`, max `100`), `search`
(queue ID, user ID, match ID, status, or rating), `sortBy` (`queuedAt`,
`updatedAt`, `rating`, `status`, `userId`), `sortOrder` (`ASC`/`DESC`, default
`ASC`), plus optional `status` (`waiting`, `matched`, `cancelled`) and `userId`.
Matched entries cannot be deleted.

## Student dashboard workflow

The student dashboard lists `open` and `ongoing` tournaments. Players can
register while a tournament is `open`; Swiss rounds in an `ongoing` tournament
remain paired by the tournament system and are not mixed into the general
matchmaking queue. The dashboard's **Find opponent** action uses the general
rating-based queue described above. On pairing, both players enter the game
room; after the game completes, they can return to the dashboard to queue again.
`GET /api/matches/me` and the leaderboard endpoints supply match history and
current ranking.

## Leaderboard

Leaderboard endpoints are public and read-only.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/leaderboard` | Paginated all-player rankings |
| `GET` | `/api/leaderboard/:userId` | One player's standing |

The list accepts `page` (default `1`) and `limit` (default `50`, max `100`).
Entries include `rank`, `userId`, `name`, `rating`, `gamesPlayed`, `wins`,
`draws`, `losses`, and `points`. Wins count for 3 points and draws for 1.
Rankings sort by rating, then points, wins, and name.

## Tournaments

All tournament endpoints require a bearer token. Coaches/admins can create,
update, start, and delete their tournaments; admins can manage any tournament.
Players can self-join tournaments while registration is open.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/tournaments` | Coach/admin | Create a tournament |
| `GET` | `/api/tournaments` | Authenticated | Searchable, sortable, paginated tournament list |
| `GET` | `/api/tournaments/my-schedule` | Authenticated | Get own tournament schedule |
| `GET` | `/api/tournaments/:id` | Authenticated | Get tournament details |
| `PATCH` | `/api/tournaments/:id` | Coach/admin | Update draft/open tournament, including status |
| `DELETE` | `/api/tournaments/:id` | Coach/admin | Delete draft/open tournament |
| `POST` | `/api/tournaments/:id/start` | Coach/admin | Start and automatically pair round one |
| `POST` | `/api/tournaments/:id/join` | Authenticated | Register or join the waiting list |
| `GET` | `/api/tournaments/:id/participants` | Authenticated | List participants |
| `GET` | `/api/tournaments/:id/matches` | Authenticated | List generated pairings and results |
| `GET` | `/api/tournaments/:id/leaderboard` | Authenticated | List current standings and rankings |
| `GET` | `/api/tournaments/:id/winner` | Authenticated | Get the winner after completion |

Create body:

```json
{
  "name": "Kingdom Chess Championship",
  "description": "Open chess tournament",
  "timeControl": "5+0",
  "maxParticipants": 16,
  "startDate": "2026-11-15T10:00:00.000Z",
  "endDate": "2026-11-15T18:00:00.000Z"
}
```

Creation sets status to `draft`. Set status to `open` with `PATCH` to accept
registrations; `POST /api/tournaments/:id/start` changes it to `ongoing` and
generates Swiss-style rounds. The round count is
`ceil(log2(registered participants))`; players with similar scores are paired,
repeat opponents are avoided when possible, and an odd field receives a bye.
New rounds start automatically when all matches in the current round are
completed. Scores award 1 point for a win and 0.5 for a draw. The final round
changes the status to `completed`; the winner is the first-ranked participant.
Statuses are `draft`, `open`, `ongoing`, and `completed`. When full, new
registrants get `waiting` participant status. `timeControl` uses
`minutes+increment-seconds` format and defaults to `5+0`.
Tournament list parameters: `page` (default `1`), `limit` (default `10`, max
`100`), `search` (name or description), `sortBy` (`name`, `startDate`,
`createdAt`, `maxParticipants`), `sortOrder` (`ASC`/`DESC`, default `ASC`), and
optional `status`.

## Validation and errors

Request DTOs are validated globally. Unknown body fields are rejected, and
invalid values return HTTP `400`. Common error response:

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

Other common statuses:

- `401 Unauthorized`: access token absent, invalid, or expired.
- `403 Forbidden`: authenticated role or ownership is insufficient.
- `404 Not Found`: requested record does not exist.
- `409 Conflict`: email is already registered.

## Frontend request example

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}
```

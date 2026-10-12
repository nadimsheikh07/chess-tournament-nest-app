# Kingdom of Chess API: Frontend Guide

This guide describes the HTTP API for frontend integration. Swagger UI is also
available at `GET /api/v1/docs` when the backend is running.

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

The development default allows `http://localhost:3001` and
`http://localhost:5173`. Set the production frontend origin explicitly when
deploying. The browser's `strict-origin-when-cross-origin` referrer policy is
normal and does not itself indicate a CORS failure.

All application routes use the versioned `/api/v1` prefix. Send JSON request
bodies with:

```http
Content-Type: application/json
```

For protected routes, enable credentials so the browser sends the HTTP-only
cookies returned by register/login/refresh. Bearer access tokens remain
accepted for API clients that do not use browser cookies.

```http
Authorization: Bearer <accessToken>
```

## Authentication

Successful single-resource responses wrap their payload in `{ "data": ... }`.
Paginated responses use `{ "data": [...], "meta": {...} }`. Error responses
use `{ "statusCode": ..., "message": ..., "error": ... }`. Response examples
below show unwrapped payloads unless they explicitly describe pagination.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | No | Register as a player and set HTTP-only cookies |
| `POST` | `/api/v1/auth/login` | No | Sign in and set HTTP-only cookies |
| `POST` | `/api/v1/auth/refresh` | Refresh cookie | Rotate the access and refresh cookies |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoke the current refresh-token session |
| `GET` | `/api/v1/auth/profile` | Bearer | Get the identity from the access token |

| `GET` | `/api/v1/me` | Access cookie | Get the authenticated user's ID, email, and role |

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

### Login and cookie session

Login body:

```json
{
  "email": "avery@example.com",
  "password": "StrongPass123!"
}
```

Register and login set `access_token` and `refresh_token` as HTTP-only,
`SameSite=Lax` cookies; JWTs are not returned in JSON. Refresh accepts the
refresh cookie (no request body) and rotates both cookies. The frontend
retries a protected request once after an access-cookie `401`. Logout returns:

```json
{ "message": "Logged out successfully" }
```

`GET /api/v1/me` returns `userId`, `email`, and the user's current role. Role
authorization is checked on the backend for every protected request, and the
frontend redirects students away from coach pages and coach/admin users away
from the student dashboard.

## Roles and access

Roles are `player`, `coach`, and `admin`.

- Admin-only: user administration (`GET/POST /api/v1/users`,
  `GET/PATCH/DELETE /api/v1/users/:id`).
- Coach/admin: create, update, and delete matches; inspect all matchmaking
  queue entries.
- Authenticated: profile, matches, tournaments, and matchmaking routes unless
  an endpoint below is explicitly described as public.
- Public: `GET /api/v1/leaderboard` and `GET /api/v1/leaderboard/:userId`.

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
GET /api/v1/matches?page=2&limit=20&search=completed&sortBy=createdAt&sortOrder=DESC
```

## Users

All user endpoints require an authenticated cookie session.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/users` | Admin | Create a user |
| `GET` | `/api/v1/users` | Admin | Paginated user list |
| `GET` | `/api/v1/users/me` | Authenticated | Get own profile |
| `PATCH` | `/api/v1/users/me` | Authenticated | Update own name/email |
| `GET` | `/api/v1/users/me/matches` | Authenticated | List own matches |
| `GET` | `/api/v1/users/me/schedule` | Authenticated | List own tournament registrations |
| `GET` | `/api/v1/users/:id` | Admin | Get one user |
| `PATCH` | `/api/v1/users/:id` | Admin | Update name/email/password/role |
| `DELETE` | `/api/v1/users/:id` | Admin | Delete a user |

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

All match endpoints require an authenticated cookie session. Match creation, update, and deletion
are restricted to coaches and admins; any authenticated user can list/read them.
Tournament games are paired automatically and cannot be created or reassigned
through these routes.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/matches` | Coach/admin | Create a match |
| `GET` | `/api/v1/matches` | Authenticated | Paginated match list |
| `GET` | `/api/v1/matches/me` | Authenticated | Paginated match history for the signed-in player |
| `GET` | `/api/v1/matches/:id` | Authenticated | Get one match |
| `GET` | `/api/v1/matches/:id/game` | Player, coach, or admin | Restore game, clocks, PGN, and legal moves (players only) |
| `POST` | `/api/v1/matches/:id/moves` | Player in match | Submit a chess move |
| `POST` | `/api/v1/matches/:id/draw-offer` | Player in match | Offer a draw |
| `POST` | `/api/v1/matches/:id/draw-offer/accept` | Opponent | Accept a draw offer |
| `POST` | `/api/v1/matches/:id/draw-offer/decline` | Opponent | Decline a draw offer |
| `POST` | `/api/v1/matches/:id/draw-offer/cancel` | Offering player | Cancel a pending draw offer |
| `PATCH` | `/api/v1/matches/:id` | Coach/admin | Update match |
| `DELETE` | `/api/v1/matches/:id` | Coach/admin | Delete match |

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

The game-state endpoint restores `{ match, fen, turn, playerColor, legalMoves,
moves, movePositions, whiteTimeMs, blackTimeMs, clockSnapshotAt }` from
server-persisted PGN and clocks. Players can reconnect or refresh and receive
the current board and clock snapshot. Coaches and admins may spectate; their
`playerColor` is `null` and `legalMoves` is empty. Authenticated Socket.IO
clients can join a match with `watch-match` and receive `game-updated` events.
Submit a move as `{ "from": "e2", "to": "e4" }`; add `"promotion": "q"`,
`"r"`, `"b"`, or `"n"` when promoting. The server validates every move against
the persisted board and turn, applies clock increments, and adjudicates
checkmate, stalemate, threefold repetition, the 50-move rule, and timeouts.
Draw offers are stored server-side and may be accepted, declined, or cancelled
by the offering player. The server updates PGN and ratings; only match players
may make moves or offer/respond to draws.

## Matchmaking

All matchmaking endpoints require an authenticated cookie session.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/matchmaking` | Authenticated | Join the queue and attempt a pairing |
| `GET` | `/api/v1/matchmaking/me` | Authenticated | Get own latest queue entry |
| `DELETE` | `/api/v1/matchmaking/me` | Authenticated | Leave own waiting queue entry |
| `GET` | `/api/v1/matchmaking` | Coach/admin | Paginated queue list |
| `GET` | `/api/v1/matchmaking/:id` | Owner or coach/admin | Get one queue entry |
| `DELETE` | `/api/v1/matchmaking/:id` | Owner or coach/admin | Delete an unmatched queue entry |

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
to the API origin using Socket.IO with credentials enabled; the browser sends
the HTTP-only access cookie automatically. Invalid or expired cookies are
disconnected. Only match participants may join that match's Socket.IO room.
Socket.IO uses the same credentialed allowed origins as HTTP CORS.

The queue selects the closest eligible rating among waiting players (not FIFO).
Its acceptable gap starts at
100 points, expands by 50 points per minute, and caps at 800 points. Queue list
parameters: `page` (default `1`), `limit` (default `10`, max `100`), `search`
(queue ID, user ID, match ID, status, or rating), `sortBy` (`queuedAt`,
`updatedAt`, `rating`, `status`, `userId`), `sortOrder` (`ASC`/`DESC`, default
`ASC`), plus optional `status` (`waiting`, `matched`, `cancelled`) and `userId`.
Matched entries cannot be deleted.

## Student dashboard workflow

The student dashboard lists `open` and `ongoing` tournaments. Players can
register while a tournament is `open`; round-robin rounds in an `ongoing` tournament
remain paired by the tournament system and are not mixed into the general
matchmaking queue. The dashboard's **Find opponent** action uses the general
rating-based queue described above. On pairing, both players enter the game
room; after the game completes, they can return to the dashboard to queue again.
`GET /api/v1/matches/me` and the leaderboard endpoints supply match history and
current ranking.

## Leaderboard

Leaderboard endpoints are public and read-only.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/leaderboard` | Paginated all-player rankings |
| `GET` | `/api/v1/leaderboard/:userId` | One player's standing |

The list accepts `page` (default `1`) and `limit` (default `50`, max `100`).
Entries include `rank`, `userId`, `name`, `rating`, `gamesPlayed`, `wins`,
`draws`, `losses`, and `points`. Wins count for 1 point, draws for 0.5, and
losses for 0. Rankings sort by points, wins, rating, and name, in that order.

## Tournaments

All tournament endpoints require an authenticated cookie session. Coaches/admins can create,
update, start, and delete their tournaments; admins can manage any tournament.
Players can self-join tournaments while registration is open.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/tournaments` | Coach/admin | Create a tournament |
| `GET` | `/api/v1/tournaments` | Authenticated | Searchable, sortable, paginated tournament list |
| `GET` | `/api/v1/tournaments/my-schedule` | Authenticated | Get own tournament schedule |
| `GET` | `/api/v1/tournaments/:id` | Authenticated | Get tournament details |
| `PATCH` | `/api/v1/tournaments/:id` | Coach/admin | Update draft/open tournament, including status |
| `DELETE` | `/api/v1/tournaments/:id` | Coach/admin | Delete draft/open tournament |
| `POST` | `/api/v1/tournaments/:id/start` | Coach/admin | Start and automatically pair round one |
| `POST` | `/api/v1/tournaments/:id/join` | Authenticated | Register or join the waiting list |
| `GET` | `/api/v1/tournaments/:id/participants` | Authenticated | List participants |
| `GET` | `/api/v1/tournaments/:id/matches` | Authenticated | List generated pairings and results |
| `GET` | `/api/v1/tournaments/:id/leaderboard` | Authenticated | List current standings and rankings |
| `GET` | `/api/v1/tournaments/:id/winner` | Authenticated | Get the winner after completion |

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
registrations; `POST /api/v1/tournaments/:id/start` changes it to `ongoing` and
generates a complete round robin. The round count is `n - 1` for an even field
and `n` for an odd field; each pair meets exactly once and odd fields rotate a
bye so each participant receives one. The next round starts automatically when
all matches in the current round are completed. Scores award 1 point for a win
or bye, 0.5 for a draw, and 0 for a loss. Standings sort by points, wins,
registration time (earlier first), then participant ID ascending. The final
round changes the status to `completed` and the first-ranked participant is
declared winner. Tournament controls such as `5+3` set both the starting clock
and per-move increment.
Statuses are `draft`, `open`, `ongoing`, and `completed`. When full, new
registrants get `waiting` participant status. `timeControl` uses
`minutes+increment-seconds` format and defaults to `5+0`.
Tournament dates are stored as ISO-8601 instants. The frontend renders
`DD/MM/YYYY HH:mm` in the viewer's local timezone and includes the timezone
abbreviation; local form values are converted to UTC before submission.
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

- `401 Unauthorized`: access cookie absent, invalid, or expired.
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

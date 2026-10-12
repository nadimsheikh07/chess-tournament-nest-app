# Kingdom of Chess API: Frontend Guide

This guide describes the HTTP API for frontend integration. Swagger UI is also
available at `GET /api/docs` when the backend is running.

## Base URL and headers

Set the API origin per environment, for example:

```text
Development: http://localhost:3000
Production:  https://<your-api-host>
```

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

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/matches` | Coach/admin | Create a match |
| `GET` | `/api/matches` | Authenticated | Paginated match list |
| `GET` | `/api/matches/:id` | Authenticated | Get one match |
| `PATCH` | `/api/matches/:id` | Coach/admin | Update match |
| `DELETE` | `/api/matches/:id` | Coach/admin | Delete match |

Create body:

```json
{
  "whitePlayerId": "b6ef4a16-78e2-4b73-a7cc-c778c6bc5ab9",
  "blackPlayerId": "bf2a43ce-d151-45f1-a11f-54a236cdf7c8",
  "tournamentId": null,
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

The join endpoint has no request body; it uses the authenticated user's rating.
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

The queue selects the closest eligible rating. Its acceptable gap starts at
100 points, expands by 50 points per minute, and caps at 800 points. Queue list
parameters: `page` (default `1`), `limit` (default `10`, max `100`), `search`
(queue ID, user ID, match ID, status, or rating), `sortBy` (`queuedAt`,
`updatedAt`, `rating`, `status`, `userId`), `sortOrder` (`ASC`/`DESC`, default
`ASC`), plus optional `status` (`waiting`, `matched`, `cancelled`) and `userId`.
Matched entries cannot be deleted.

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

All tournament endpoints require a bearer token. Coaches/admins can create
tournaments; updates are limited to the tournament's coach. Players can join
upcoming tournaments. There is no tournament-delete route.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/tournaments` | Coach/admin | Create a tournament |
| `GET` | `/api/tournaments` | Authenticated | Searchable, sortable, paginated tournament list |
| `GET` | `/api/tournaments/my-schedule` | Authenticated | Get own tournament schedule |
| `GET` | `/api/tournaments/:id` | Authenticated | Get tournament details |
| `PATCH` | `/api/tournaments/:id` | Owning coach/admin | Update tournament details |
| `POST` | `/api/tournaments/:id/join` | Authenticated | Register or join the waiting list |
| `GET` | `/api/tournaments/:id/participants` | Authenticated | List participants |
| `GET` | `/api/tournaments/:id/leaderboard` | Authenticated | List completed participants by score |

Create body:

```json
{
  "name": "Kingdom Chess Championship",
  "description": "Open chess tournament",
  "maxParticipants": 16,
  "startDate": "2026-11-15T10:00:00.000Z",
  "endDate": "2026-11-15T18:00:00.000Z"
}
```

Creation sets status to `upcoming`. Tournament statuses are `draft`, `upcoming`,
`active`, `completed`, and `cancelled`. Registration is open only while status
is `upcoming`; when full, new registrants get `waiting` participant status.
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

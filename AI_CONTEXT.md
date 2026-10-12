# AI_CONTEXT.md — Kingdom of Chess

## 1. Project Overview

**Project Name:** Kingdom of Chess  
**Project Type:** Full-stack real-time multiplayer chess tournament platform  
**Purpose:** Full-stack developer technical assignment  
**Priority:** Deliver a complete, functional end-to-end application within the 48-hour time limit.

Build a chess tournament platform where coaches can manage tournaments and students can register, join tournaments, get automatically paired with opponents, play real-time chess games, and view updated results and leaderboards.

The application must be functional, maintainable, secure, responsive, and easy to run locally.

## 2. Technology Stack

### Frontend
- Next.js with App Router
- TypeScript with strict typing
- React
- Chessboard UI library compatible with React
- `chess.js` for client-side chess interaction and move validation
- TanStack Query for API requests and server-state management
- Socket.IO Client for real-time communication
- Responsive CSS or the existing UI framework in the repository

### Backend
- NestJS
- TypeScript
- REST APIs
- Socket.IO using NestJS WebSocket Gateway
- JWT-based authentication using HTTP-only cookies
- `class-validator` and `class-transformer` for request validation
- PostgreSQL
- Database migrations and seed data
- A suitable ORM already present in the repository; otherwise, select and configure one consistently

### Development and Quality
- ESLint and Prettier if already configured
- Unit and integration testing
- Environment-based configuration
- Git-friendly project structure
- README with installation, configuration, migration, seeding, and run instructions

Do not introduce unnecessary technologies or dependencies.

## 3. User Roles

### Coach
- Register and log in.
- Create tournaments.
- View tournaments they manage.
- Update or manage tournament settings.
- Monitor participants, matches, and tournament results.

### Student
- Register and log in.
- Browse available tournaments.
- Join an open tournament.
- Enter the matchmaking queue.
- Get paired with an opponent automatically.
- Play a real-time chess game.
- Resign or finish a game according to its rules.
- View match history, results, and leaderboard standings.

Enforce permissions on the backend. Hiding frontend buttons is not authorization.

## 4. Core Functional Requirements

### Authentication and Authorization
- Implement registration, login, logout, and current-user endpoints.
- Support the coach and student roles.
- Hash passwords securely using a suitable password-hashing library.
- Store authentication tokens in appropriately configured HTTP-only cookies.
- Protect authenticated routes and validate user permissions.
- Validate request payloads and return consistent error responses.
- Configure cookie security correctly for local development and production.

### Tournament Management
- Allow authorized coaches to create and manage tournaments.
- Include tournament information such as name, description, status, capacity, and relevant timestamps.
- Allow students to join tournaments that accept registrations.
- Prevent duplicate participation.
- Reject joining tournaments that are full, closed, or otherwise unavailable.
- Track tournament participants and their match results.
- Validate all tournament state transitions on the server.

### Matchmaking
- Implement an automatic FIFO matchmaking queue for eligible students.
- Pair two eligible players when a valid pairing is available.
- Prevent users from entering the same queue multiple times.
- Prevent users from being paired into multiple active matches simultaneously.
- Handle simultaneous join requests safely using database transactions or appropriate locking.
- Notify both players when a match has been created.
- Remove matched players from the waiting queue atomically.
- Handle disconnects and stale queue entries without corrupting match state.

### Real-Time Chess
- Render an interactive chessboard for each player.
- Support legal chess moves, captures, check, checkmate, castling, en passant, and promotion.
- Use `chess.js` for chess rules and move calculations.
- Maintain the authoritative game state on the server.
- Broadcast valid moves and updated game state to both players using Socket.IO.
- Synchronize the board, player turns, game status, and clocks.
- Persist moves and the final PGN.
- Support resignation, timeout, checkmate, stalemate, and draw outcomes.
- Reject illegal moves, out-of-turn moves, moves from unauthorized players, and moves after a game has ended.

Never trust a move or final result submitted directly by the client.

### Chess Clock
- Implement a 5-minute-per-player clock with a 0-second increment (5+0).
- The server is the source of truth for the remaining time.
- Track whose clock is running.
- Determine timeout outcomes on the server.
- Synchronize clock updates with both clients.
- Avoid relying on client-side timers to determine winners.

### Results and Leaderboard
- Persist completed match results.
- Calculate leaderboard scores using:
  - Win: 1 point
  - Draw: 0.5 points
  - Loss: 0 points
- Update tournament standings after each completed match.
- Prevent duplicate result processing.
- Display player rankings, points, wins, draws, and losses.
- Use a consistent, deterministic sorting rule for ties.

## 5. Suggested Database Entities

Adapt these entities to the existing repository and assignment specification.

### Users
- `id`
- `name`
- `email` — unique
- `password_hash`
- `role`
- `created_at`
- `updated_at`

### Tournaments
- `id`
- `name`
- `description`
- `status`
- `capacity`
- `created_by`
- `created_at`
- `updated_at`

### Tournament Participants
- `id`
- `tournament_id`
- `user_id`
- `joined_at`

Enforce uniqueness for the tournament and user combination.

### Matches
- `id`
- `tournament_id`
- `white_player_id`
- `black_player_id`
- `status`
- `result`
- `termination_reason`
- `fen`
- `pgn`
- `white_remaining_ms`
- `black_remaining_ms`
- `active_color`
- `last_move_at`
- `started_at`
- `finished_at`

### Moves
- `id`
- `match_id`
- `move_number`
- `player_id`
- `san`
- `uci`
- `fen_after_move`
- `created_at`

### Matchmaking Queue
- `id`
- `tournament_id`
- `user_id`
- `joined_at`
- `status`

Add appropriate foreign keys, indexes, uniqueness constraints, and database transactions.

These are suggested fields, not a reason to introduce unnecessary complexity. Keep the database schema consistent with the actual requirements.

## 6. Suggested REST API Structure

Use a consistent prefix such as `/api/v1`. Adjust the prefix if the assignment specifies another convention.

### Authentication
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Tournaments
- `POST /tournaments`
- `GET /tournaments`
- `GET /tournaments/:id`
- `PATCH /tournaments/:id`
- `POST /tournaments/:id/join`
- `GET /tournaments/:id/participants`
- `GET /tournaments/:id/leaderboard`

### Matchmaking
- `POST /tournaments/:id/queue`
- `DELETE /tournaments/:id/queue`
- `GET /tournaments/:id/queue/status`

### Matches
- `GET /matches/:id`
- `GET /matches/:id/moves`
- `GET /matches/:id/result`
- `POST /matches/:id/resign`
- `POST /matches/:id/draw-offer` — only if draw offers are part of the agreed rules
- `POST /matches/:id/draw-accept` — only if draw offers are implemented

Keep REST endpoints for resource operations and use WebSockets for live gameplay.

## 7. WebSocket Design

Use authenticated Socket.IO connections.

Suggested events:

**Client to server**
- `match:join`
- `game:move`
- `game:resign`
- `game:offer-draw`
- `game:accept-draw`

**Server to client**
- `match:found`
- `game:state`
- `game:move`
- `game:clock`
- `game:finished`
- `game:error`

Event names may be adapted to the actual implementation, but document the final contract.

Every event must validate the authenticated user, match membership, match status, and payload.

Use match-specific rooms to prevent unrelated players from receiving game updates. Reconnection should retrieve the current authoritative match state.

## 8. Suggested NestJS Architecture

Organize the backend by business domain.

```text
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   ├── config/
│   ├── auth/
│   ├── users/
│   ├── tournaments/
│   ├── participants/
│   ├── matchmaking/
│   ├── matches/
│   ├── moves/
│   ├── leaderboard/
│   └── database/
├── test/
├── .env.example
├── README.md
└── package.json
```

Each module should contain the relevant controller, service, DTOs, and module configuration. Add repositories or ORM-specific files according to the selected database approach.

Keep controllers thin. Put business logic in services. Use guards for authentication and authorization. Use transactions for pairing players and finalizing match results.

## 9. Suggested Frontend Structure

```text
frontend/
├── src/
│   ├── app/
│   │   ├── login/
│   │   ├── register/
│   │   ├── tournaments/
│   │   ├── matches/
│   │   ├── dashboard/
│   │   └── leaderboard/
│   ├── components/
│   │   ├── chess/
│   │   ├── tournaments/
│   │   ├── matches/
│   │   ├── leaderboard/
│   │   └── shared/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   └── providers/
├── public/
├── .env.example
└── package.json
```

Follow the repository's existing structure when available rather than forcing this exact layout.

The UI should include:
- Authentication screens.
- Tournament listing and details.
- Tournament creation and management for coaches.
- Join tournament and matchmaking status.
- Live chessboard with player names, colors, clocks, and game status.
- Match completion and result display.
- Tournament leaderboard.
- Loading, error, empty, and disconnected states.
- Responsive desktop and mobile layouts.

## 10. Security and Reliability Rules

- Validate every request and WebSocket payload.
- Never expose password hashes, JWT secrets, or sensitive environment variables.
- Use parameterized database operations through the selected ORM.
- Apply role-based and resource-level authorization.
- Configure CORS and cookie credentials deliberately.
- Prevent duplicate match creation and duplicate result finalization.
- Handle race conditions in matchmaking and match completion.
- Ensure clients cannot decide their own results or modify opponents' clocks.
- Keep secrets in environment variables and provide only safe example values.
- Add useful logging without logging credentials or authentication tokens.
- Avoid arbitrary trust in client-supplied user IDs.

## 11. Testing Requirements

Prioritize tests for critical business rules.

### Backend
- Registration, login, and authorization.
- Coach-only tournament management.
- Joining a tournament and duplicate participation prevention.
- FIFO matchmaking and concurrent queue requests.
- Legal and illegal chess moves.
- Turn enforcement and match membership.
- Timeout, resignation, checkmate, and draw outcomes.
- Result idempotency and leaderboard calculations.

### Frontend
- Authentication forms and validation.
- Tournament joining flow.
- Matchmaking states.
- Chessboard move interaction.
- Socket disconnection and reconnection.
- Match completion and leaderboard rendering.

Include an end-to-end test for the primary flow if time permits.

## 12. AI Coding Instructions

When generating or modifying code, follow these rules:

1. Inspect the existing repository before creating or modifying files.
2. Read the assignment specification and treat it as the source of truth.
3. Identify the current dependencies, scripts, architecture, and database configuration.
4. Reuse existing conventions and avoid unnecessary rewrites.
5. Implement working features, not placeholders, fake API responses, or hardcoded success states.
6. Use strict TypeScript and appropriate DTOs, types, interfaces, and enums.
7. Separate controllers, services, database access, and presentation logic.
8. Include validation, error handling, authorization, and persistence.
9. Keep REST and WebSocket contracts consistent across frontend and backend.
10. Provide migrations and seed data where needed.
11. Add tests for critical business logic.
12. Update the README whenever setup, APIs, environment variables, or architecture changes.
13. Do not silently omit requirements. If a feature cannot be completed, state what remains.
14. Do not invent assignment requirements. Mark assumptions explicitly and choose the simplest reasonable implementation when clarification is unnecessary.
15. After each meaningful implementation stage, run relevant linting, type checks, tests, and builds where possible.
16. Fix errors introduced by the implementation before proceeding.
17. Never claim that code, tests, migrations, or builds succeeded unless they were actually verified.

## 13. Implementation Priority

Complete the application in this order:

1. Repository inspection and requirement checklist.
2. Project setup, environment configuration, and database schema.
3. Authentication and role-based authorization.
4. Tournament creation, listing, and joining.
5. Transaction-safe FIFO matchmaking.
6. Server-authoritative chess rules, clocks, and Socket.IO gameplay.
7. Persistent results, PGN, match history, and leaderboard.
8. Frontend integration and responsive UI.
9. Critical tests, bug fixes, and security checks.
10. README, `.env.example`, migration/seed instructions, and final verification.

Prioritize one complete working user journey over numerous incomplete features.

## 14. Definition of Done

The project is ready for submission when:

- The frontend and backend start using documented commands.
- The database can be created and seeded reproducibly.
- Users can register and log in with appropriate roles.
- Coaches can manage tournaments.
- Students can join eligible tournaments.
- Two students can be paired automatically.
- Both players can play a synchronized, legal chess game.
- Server-side clocks and game termination rules work correctly.
- Results and PGN are persisted.
- The leaderboard reflects completed results.
- Unauthorized operations are rejected.
- Critical tests pass.
- No known blocking build or runtime errors remain.
- The README clearly explains setup, architecture, APIs, and limitations.

**Final instruction to the AI:** Work as a senior full-stack engineer. Make the smallest reliable changes that satisfy the assignment, prioritize correctness and a working end-to-end experience, and clearly report implemented features, verification results, and remaining limitations.
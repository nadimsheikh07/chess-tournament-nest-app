<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Chess APIs

For frontend routes, authentication, roles, request/response examples, and
query parameters, see the [Frontend API Guide](./docs/FRONTEND_API.md).

The versioned REST API is rooted at `/api/v1`; Swagger is available at
`/api/v1/docs`. All REST bodies and query parameters are validated with DTOs.
Successful single-resource responses use `{ "data": ... }`; paginated
responses use `{ "data": [...], "meta": { ... } }`. Errors use Nest's
standard `{ "statusCode": ..., "message": ..., "error": ... }` response.

All match and matchmaking endpoints require a bearer access token. Standalone
match creation, updates, and deletion are restricted to coaches and admins.

### Tournaments

Coaches and admins can create and manage tournaments. A tournament starts in
`draft`; update its `status` to `open` to allow players to self-join, then use
`POST /tournaments/:id/start` to begin. Tournament creation accepts a
`timeControl` in `minutes+increment` format (for example, `5+0`); it defaults
to `5+0` when omitted.

Pairings use a complete round robin: every pair meets once, with `n - 1` rounds
for an even field and `n` rounds for an odd field. In an odd field, each player
receives one rotating bye. Each round is created automatically after all its
matches are completed. Tournament matches cannot be manually created,
reassigned, cancelled, or deleted. Tournament time controls such as `5+3`
apply the increment to each legal move.

- `POST /tournaments` creates a draft; `GET /tournaments` lists tournaments.
- `PATCH /tournaments/:id` updates a draft/open tournament, including changing
  its status between `draft` and `open`; `DELETE /tournaments/:id` deletes a
  draft/open tournament.
- `POST /tournaments/:id/join` lets a player self-register while the tournament
  is open. Registrations beyond `maxParticipants` are waitlisted.
- `POST /tournaments/:id/start` generates round one and changes the status to
  `ongoing`.
- `GET /tournaments/:id/matches` lists all generated pairings and results.
- `GET /tournaments/:id/leaderboard` returns current points and rankings.
- `GET /tournaments/:id/winner` returns the top-ranked participant after the
  tournament is `completed`.

Tournament scoring is 1 point for a win, 0.5 for a draw, and 0 for a loss; a
bye is worth 1 point. Standings are ordered by points, then wins, registration
time (earlier first), and participant ID (ascending). Rankings use sequential
positions, and the first participant under that order is declared the winner
when the tournament completes.

### User management

All user endpoints require a bearer access token. `GET /users/me`,
`PATCH /users/me`, and the `/users/me/*` routes are for the authenticated
user. `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, and
`DELETE /users/:id` require an admin role. `GET /users` supports pagination,
search across name/email/role, and sorting with `page`, `limit`, `search`,
`sortBy`, and `sortOrder` query parameters (for example,
`GET /users?page=2&limit=20&search=coach&sortBy=rating&sortOrder=DESC`).
Admin create/update requests accept the `role` values `player`, `coach`, and
`admin`; passwords are hashed before storage. Users cannot change their own
role through profile updates, and the last admin cannot be demoted or deleted.

- `POST /matches` creates a standalone scheduled match with `whitePlayerId`
  and `blackPlayerId`. Tournament matchups are generated automatically.
- `GET /matches` and `GET /matches/:id` retrieve matches.
- `PATCH /matches/:id` updates match details. Mark a match `completed` and
  provide `result` as `white_win`, `black_win`, or `draw` to record its result.
- `DELETE /matches/:id` removes a match.
- `POST /matchmaking` queues the authenticated player using their current Elo
  rating. It pairs the closest eligible waiting player; the allowable rating
  difference starts at 100 and widens by 50 points per minute, up to 800.
- `GET /matchmaking/me` returns the player's latest queue entry, and
  `DELETE /matchmaking/me` leaves an active queue.
- Coaches and admins can inspect queue entries using `GET /matchmaking` and
  `GET /matchmaking/:id`.
- `GET /matchmaking` supports pagination (`page`, `limit`), search across queue
  ID, user ID, match ID, status, or rating, sorting (`sortBy`, `sortOrder`),
  and optional `status` and `userId` filters.
- `GET /leaderboard?page=1&limit=50` returns a paginated leaderboard;
  `GET /leaderboard/:userId` returns one player's standing. Rankings and W/D/L
  statistics are derived from completed matches, with 1 point per win, 0.5 per
  draw, and 0 per loss. Rankings sort by points, wins, rating, and name, in
  that order; ranks are sequential. Leaderboard entries are read-only.

### Creating the initial admin

The `admin` role is the highest-privilege role in this application. After
building the backend and configuring its database in `.env`, create an admin
from PowerShell by setting one-time credentials and running:

```powershell
$env:SUPER_ADMIN_NAME = "Chess Administrator"
$env:SUPER_ADMIN_EMAIL = "admin@example.com"
npm run build
$securePassword = Read-Host "Admin password" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:SUPER_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
npm run create:super-admin
Remove-Item Env:SUPER_ADMIN_NAME, Env:SUPER_ADMIN_EMAIL, Env:SUPER_ADMIN_PASSWORD
```

The command hashes the password before saving and fails if the email already
belongs to a user. If setup fails, it returns a non-zero exit code.

### Real-time Socket.IO events

Clients connect to the backend Socket.IO origin with
`auth: { "token": "<access-token>" }`. The server authenticates the access
token and joins the client's player room. Match participants, coaches, and
admins can subscribe to a match room with `watch-match`; spectators can read
the live board but cannot submit moves. Reconnecting clients reload the
server-persisted board and clock snapshot. The current event contract is:

| Event | Payload | Direction |
| --- | --- | --- |
| `match-found` | `{ "matchId": "<uuid>", "match": <Match> }` | Server → client |
| `game-updated` | `{ "matchId": "<uuid>" }` | Server → client |

Players begin at 1200 Elo. Ratings are recalculated from completed match
results whenever a match is created, updated, or deleted. Database schema
synchronization is enabled at startup in all environments, and the TypeORM
entities define the database schema. Remove existing tables before starting if
you want a clean schema reset. Schema synchronization can alter the database,
so only use it in environments where automatic schema changes are acceptable.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

This application has a production Docker image. To deploy the frontend, API,
and PostgreSQL together from the workspace, follow the
[Docker deployment guide](../DEPLOYMENT.md).

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

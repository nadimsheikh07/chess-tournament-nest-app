import {
  ConnectedSocket,
  OnGatewayConnection,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { ACCESS_TOKEN_COOKIE, readCookie } from '../auth/auth-cookies';
import { Match } from '../matches/entities/match.entity';

interface AccessTokenPayload {
  sub: string;
  type: 'access' | 'refresh';
}

const allowedOrigins = (
  process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({ cors: { origin: allowedOrigins, credentials: true } })
export class MatchmakingGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(Match)
    private readonly matches: Repository<Match>,
  ) {}

  async handleConnection(client: Socket) {
    const token = readCookie(
      client.handshake.headers.cookie,
      ACCESS_TOKEN_COOKIE,
    );
    if (!token) {
      client.disconnect(true);
      return;
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      client.disconnect(true);
      return;
    }

    if (payload.type !== 'access' || !payload.sub) {
      client.disconnect(true);
      return;
    }

    await client.join(this.playerRoom(payload.sub));
    client.data.userId = payload.sub;
  }

  @SubscribeMessage('watch-match')
  async watchMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId?: string },
  ) {
    const matchId = payload?.matchId;
    const userId = client.data.userId as string | undefined;
    if (!userId || !matchId) {
      return { event: 'watch-match-error', data: 'Invalid match request' };
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        matchId,
      )
    ) {
      return { event: 'watch-match-error', data: 'Invalid match request' };
    }

    const match = await this.matches.findOneBy({ id: matchId });
    if (!match) {
      return { event: 'watch-match-error', data: 'Match not found' };
    }
    const isPlayer =
      match.whitePlayerId === userId || match.blackPlayerId === userId;
    if (!isPlayer) {
      return {
        event: 'watch-match-error',
        data: 'Only a participant in this match can join its room',
      };
    }
    await client.join(this.matchRoom(matchId));
    return { event: 'watch-match-ready', data: { matchId } };
  }

  notifyMatchFound(match: Match) {
    const payload = { matchId: match.id, match };
    this.server
      .to(this.playerRoom(match.whitePlayerId))
      .emit('match-found', payload);
    this.server
      .to(this.playerRoom(match.blackPlayerId))
      .emit('match-found', payload);
  }

  notifyGameUpdated(match: Match) {
    const payload = { matchId: match.id };
    this.server
      .to(this.playerRoom(match.whitePlayerId))
      .emit('game-updated', payload);
    this.server
      .to(this.playerRoom(match.blackPlayerId))
      .emit('game-updated', payload);
    this.server.to(this.matchRoom(match.id)).emit('game-updated', payload);
  }

  private playerRoom(userId: string) {
    return `player:${userId}`;
  }

  private matchRoom(matchId: string) {
    return `match:${matchId}`;
  }
}

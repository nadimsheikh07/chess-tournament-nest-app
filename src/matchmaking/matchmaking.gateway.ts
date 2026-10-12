import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
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

@WebSocketGateway({ cors: { origin: allowedOrigins } })
export class MatchmakingGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token: unknown = client.handshake.auth?.token;
    if (typeof token !== 'string') {
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
  }

  private playerRoom(userId: string) {
    return `player:${userId}`;
  }
}

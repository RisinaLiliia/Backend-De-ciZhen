import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { PresenceService } from './presence.service';

type JwtPayload = {
  sub: string;
  role: string;
  sessionId?: string;
};

@WebSocketGateway({
  namespace: '/presence',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PresenceGateway.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly presence: PresenceService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('app.jwtSecret');
    if (!secret) throw new Error('JWT secret is not configured');
    this.jwtSecret = secret;
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as any)?.token;
    if (typeof authToken === 'string' && authToken.startsWith('Bearer ')) {
      return authToken.slice('Bearer '.length);
    }
    if (typeof authToken === 'string') return authToken;

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return null;
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwt.verify<JwtPayload>(token, { secret: this.jwtSecret });
      const userId = payload?.sub;
      if (!userId) {
        client.disconnect(true);
        return;
      }

      client.data.userId = userId;
      await Promise.all([this.presence.markOnline(userId), this.presence.touchLastSeen(userId)]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WS auth failed: ${message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (typeof userId === 'string' && userId.length > 0) {
      await this.presence.markOffline(userId);
    }
  }
}

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

type JwtPayload = {
  sub: string;
  role: string;
  sessionId?: string;
};

const wsAllowedOrigins = Array.from(
  new Set(
    [
      ...(process.env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()),
      process.env.FRONTEND_URL?.trim() ?? '',
    ].filter(Boolean),
  ),
);

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: wsAllowedOrigins.length > 0 ? wsAllowedOrigins : true,
    credentials: true,
  },
})
export class ChatsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatsGateway.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('app.jwtSecret');
    if (!secret) throw new Error('JWT secret is not configured');
    this.jwtSecret = secret;
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as Record<string, unknown> | undefined)?.token;
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
      client.join(`user:${userId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WS auth failed: ${message}`);
      client.disconnect(true);
    }
  }

  emitMessageCreated(userIds: string[], payload: unknown) {
    userIds.forEach((userId) => {
      this.server?.to(`user:${userId}`).emit('chat.message.created', payload);
    });
  }

  emitMessageRead(userIds: string[], payload: unknown) {
    userIds.forEach((userId) => {
      this.server?.to(`user:${userId}`).emit('chat.message.read', payload);
    });
  }

  emitConversationUpdated(userIds: string[], payload: unknown) {
    userIds.forEach((userId) => {
      this.server?.to(`user:${userId}`).emit('chat.conversation.updated', payload);
    });
  }
}

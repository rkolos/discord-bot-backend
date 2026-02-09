import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SharedConfigService } from '@app/shared';
import { GuildsRealtimeService } from '../guilds/guilds-realtime.service';
import { RealtimeSocketService } from './realtime-socket.service';
import type { GuildStateEventPayload, DiscordEventPayload } from '@app/shared';

/** Пишет события guild-state в .cursor/debug.log для анализа (полученные из Redis и отправленные в сокет). */
function guildStateToDebugLog(kind: 'received' | 'sent', payload: unknown): void {
  try {
    const logPath = process.env['DEBUG_LOG_PATH'] ?? path.join(process.cwd(), '.cursor', 'debug.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(
      logPath,
      JSON.stringify({
        _guildState: true,
        kind,
        payload,
        ts: new Date().toISOString(),
      }) + '\n',
    );
  } catch {
    // ignore
  }
}

const EVENT_GUILD_STATE = 'guild-state';
const EVENT_DISCORD_EVENT = 'discord-event';
const EVENT_SUBSCRIBE = 'subscribe';

/** Handshake extended with userId set by auth middleware (before connection is acknowledged). */
interface HandshakeWithUserId {
  auth?: { token?: string };
  query?: { token?: string };
  userId?: string;
}

interface AuthSocket extends Socket {
  userId?: string;
}

interface BroadcastItem {
  guildId: string;
  event: GuildStateEventPayload;
}

@WebSocketGateway({
  cors: { origin: true },
  path: '/api/realtime',
  namespace: '/guild-state',
})
export class GuildStateGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GuildStateGateway.name);
  private readonly broadcastQueue: BroadcastItem[] = [];

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly sharedConfig: SharedConfigService,
    private readonly guildsService: GuildsRealtimeService,
    private readonly realtimeSocketService: RealtimeSocketService,
  ) {
    this.logger.log('[realtime] GuildStateGateway constructed');
  }

  afterInit = (server: Server): void => {
    this.server = server;
    this.realtimeSocketService.setServer(server);
    const log = this.logger ?? new Logger(GuildStateGateway.name);
    log.log("[realtime] Gateway initialized: namespace '/guild-state' ready");
    setImmediate(() => {
      while (this.broadcastQueue.length > 0) {
        const item = this.broadcastQueue.shift();
        if (item) this.emitToGuildRoom(item.guildId, item.event);
      }
    });
    (this.server as unknown as { use: (fn: (socket: Socket, next: (err?: Error) => void) => void) => void }).use((socket: Socket, next: (err?: Error) => void) => {
      try {
        const handshake = socket?.handshake;
        if (!handshake) {
          next(new Error('Invalid handshake'));
          return;
        }
        const fromAuth = (handshake.auth as { token?: string } | undefined)?.token;
        const fromQuery = (handshake.query as { token?: string } | undefined)?.token;
        const token = fromAuth ?? fromQuery;
        const tokenPresent = !!token && typeof token === 'string';
        if (!tokenPresent) {
          next(new Error('Missing token'));
          return;
        }
        try {
          const payload = this.jwtService.verify<{ sub: string }>(token, {
            secret: this.sharedConfig.auth.jwtSecret,
          });
          const userId = payload.sub;
          (handshake as HandshakeWithUserId).userId = userId;
          socket.data.userId = userId;
          next();
        } catch {
          next(new Error('Invalid token'));
        }
      } catch (err) {
        next(err instanceof Error ? err : new Error(String(err)));
      }
    });
  };

  handleConnection = (client: AuthSocket): void => {
    const dataUserId = (client.data as { userId?: string } | undefined)?.userId;
    const handshakeUserId = (client.handshake as HandshakeWithUserId).userId;
    let userId = dataUserId ?? handshakeUserId;
    if (!userId && client.handshake?.auth) {
      const token = (client.handshake.auth as { token?: string }).token;
      if (token) {
        try {
          const payload = this.jwtService.verify<{ sub: string }>(token, {
            secret: this.sharedConfig.auth.jwtSecret,
          });
          userId = payload.sub;
        } catch {
          // ignore
        }
      }
    }
    if (!userId) {
      client.disconnect();
      return;
    }
    client.userId = userId;
  }

  handleDisconnect(): void {
    // rooms are left automatically
  }

  @SubscribeMessage(EVENT_SUBSCRIBE)
  async handleSubscribe(client: AuthSocket, payload: { guildIds?: (string | number)[] }): Promise<void> {
    const userId = client.userId;
    if (!userId || !payload?.guildIds || !Array.isArray(payload.guildIds)) return;
    const joinedRooms: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < payload.guildIds.length; i++) {
      const raw = payload.guildIds[i];
      if (typeof raw === 'number') {
        this.logger.warn(
          `Realtime subscribe: guildIds[${i}] is number; pass Snowflake as string to avoid Number.MAX_SAFE_INTEGER precision loss`,
        );
      }
      const guildIdOrDiscordId = typeof raw === 'string' ? raw : String(raw);
      if (seen.has(guildIdOrDiscordId)) continue;
      seen.add(guildIdOrDiscordId);
      const guild = await this.guildsService.findGuildByIdOrDiscordId(guildIdOrDiscordId);
      if (!guild) {
        this.logger.debug(`Realtime subscribe skip: guildIdOrDiscordId=${guildIdOrDiscordId} guildNotFound (userId=${userId})`);
        continue;
      }
      const isOwner = guild.ownerId === userId;
      const isAdmin =
        !isOwner && guild.discordGuildId
          ? await this.guildsService.userHasGuildAdmin(userId, guild.discordGuildId)
          : false;
      if (!isOwner && !isAdmin) {
        this.logger.debug(
          `Realtime subscribe skip: guildId=${guild.id} not owner nor guild admin userId=${userId} ownerId=${guild.ownerId}`,
        );
        continue;
      }
      const room = `guild:${guild.id}`;
      await client.join(room);
      joinedRooms.push(room);
    }
  }

  private getRoomSize(room: string): number {
    const server = this.realtimeSocketService.getServer() ?? this.server;
    if (!server) return 0;
    const adapter = (server as unknown as { adapter?: { rooms?: Map<string, Set<string>> } }).adapter;
    const set = adapter?.rooms?.get(room);
    return set != null ? set.size : 0;
  }

  private emitToGuildRoom(guildId: string, event: GuildStateEventPayload): void {
    const server = this.realtimeSocketService.getServer() ?? this.server;
    if (!server) return;
    const room = `guild:${guildId}`;
    guildStateToDebugLog('sent', event);
    server.to(room).emit(EVENT_GUILD_STATE, event);
  }

  broadcastToGuild(guildId: string, event: GuildStateEventPayload): void {
    guildStateToDebugLog('received', event);
    if (!this.realtimeSocketService.isReady() && !this.server) {
      this.broadcastQueue.push({ guildId, event });
      this.logger.debug(
        `[realtime] broadcast queued (server not ready) guildId=${guildId} parameter=${event.parameter} queueSize=${this.broadcastQueue.length}`,
      );
      return;
    }
    this.emitToGuildRoom(guildId, event);
  }

  broadcastDiscordEventToGuild(guildId: string, payload: DiscordEventPayload): void {
    if (payload.eventType === 'PRESENCE_UPDATE') return;
    const server = this.realtimeSocketService.getServer() ?? this.server;
    if (!server) return;
    const room = `guild:${guildId}`;
    server.to(room).emit(EVENT_DISCORD_EVENT, payload);
  }
}

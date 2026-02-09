import { Controller, Get } from '@nestjs/common';
import { RealtimeBootstrapService } from './realtime-bootstrap.service';

/**
 * Контроллер привязывает RealtimeBootstrapService к дереву (Controller → RealtimeBootstrapService → GuildStateRedisSubscriberService),
 * чтобы цепочка провайдеров создавалась при инициализации. Подписка на Redis запускается в onApplicationBootstrap подписчика.
 */
@Controller('internal/realtime')
export class RealtimeBootstrapController {
  constructor(private readonly _bootstrap: RealtimeBootstrapService) {}

  @Get('ping')
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

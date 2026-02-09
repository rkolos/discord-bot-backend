import { Injectable, OnModuleInit } from '@nestjs/common';
import { GuildStateGateway } from './guild-state.gateway';
import { RealtimeBootstrapService } from './realtime-bootstrap.service';

@Injectable()
export class RealtimeInitializerService implements OnModuleInit {
  // Инжектим зависимости, чтобы Nest создал их при инициализации модуля
  constructor(
    private readonly _gateway: GuildStateGateway,
    private readonly _bootstrap: RealtimeBootstrapService,
  ) {}

  onModuleInit(): void {
    // Ничего не делаем: достаточно факта создания зависимостей
  }
}

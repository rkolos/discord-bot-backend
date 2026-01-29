import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminUser } from '@app/shared';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AdminUser }>();
    return request.user;
  },
);

import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { AdminUser, AdminUserRole } from '@app/shared';
import { PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class AdminAuthGuard extends AuthGuard('admin-jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const activated = await super.canActivate(context);
    if (!activated) {
      return false;
    }
    const request = context.switchToHttp().getRequest<{ user?: AdminUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
    if (
      user.role !== AdminUserRole.ADMIN &&
      user.role !== AdminUserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }
    return true;
  }
}

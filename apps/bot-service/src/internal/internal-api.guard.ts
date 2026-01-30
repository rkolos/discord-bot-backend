import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = this.configService.get<string>('INTERNAL_API_SECRET');
    if (!secret || secret.length === 0) {
      return true;
    }
    const header = request.headers['x-internal-secret'];
    if (header !== secret) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing X-Internal-Secret',
      });
    }
    return true;
  }
}

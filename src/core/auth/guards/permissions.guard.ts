import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) return true;

    const user = context.switchToHttp().getRequest().user;
    const userId = user?.id ?? user?.sub;
    if (!userId) throw new ForbiddenException('User not authenticated');

    const permissions = await this.prisma.permission.findMany({
      where: {
        name: { in: requiredPermissions },
        roles: {
          some: {
            role: { user_roles: { some: { user_id: userId } } },
          },
        },
      },
      select: { name: true },
    });

    if (permissions.length !== requiredPermissions.length) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

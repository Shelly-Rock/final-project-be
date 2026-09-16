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

    const activeRole = user?.role;
    if (!activeRole) throw new ForbiddenException('No active role');

    // Only check permissions of the ACTIVE role (not union of all roles)
    const permissions = await this.prisma.permission.findMany({
      where: {
        name: { in: requiredPermissions },
        deleted_at: null,
        roles: {
          some: {
            role: {
              name: activeRole,
              deleted_at: null,
              user_roles: { some: { user_id: userId } },
            },
          },
        },
      },
      select: { name: true },
    });

    const foundNames = new Set(permissions.map((p) => p.name));
    const allFound = requiredPermissions.every((name) => foundNames.has(name));

    if (!allFound) {
      const missingPermissions = requiredPermissions.filter((name) => !foundNames.has(name));
      console.error(
        `Permission denied for user ${userId} with role ${activeRole}. Missing: ${missingPermissions.join(', ')}`,
      );
      throw new ForbiddenException(
        `Insufficient permissions. Missing: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}

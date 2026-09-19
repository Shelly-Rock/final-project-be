import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface AuthenticatedRequest {
  user?: {
    sub?: number | string;
    id?: number | string;
    role?: string;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Public routes are allowed to proceed without an authenticated user.
    if (!user && (!requiredRoles || requiredRoles.length === 0)) {
      return true;
    }

    const userId = Number(user?.sub ?? user?.id);
    const currentRole = String(user?.role ?? '')
      .trim()
      .toUpperCase();

    if (!user || !Number.isInteger(userId) || userId <= 0 || !currentRole) {
      console.error('RolesGuard: User not authenticated', user);
      require('fs').appendFileSync(
        'roles-debug.log',
        `[${new Date().toISOString()}] Auth fail: ${JSON.stringify(user)}\n`,
      );
      throw new ForbiddenException('User not authenticated');
    }

    // Keep a numeric sub on the request for @CurrentUser('sub').
    user.sub = userId;
    user.role = currentRole;

    // The JWT role only identifies the active role. A token minted before the
    // account or assignment was disabled must not retain authorization.
    const assigned = await this.prisma.userRole.findFirst({
      where: {
        user_id: userId,
        user: { is_active: true, deleted_at: null },
        role: { name: currentRole, deleted_at: null },
      },
      select: { role_id: true },
    });

    if (!assigned) {
      console.error('RolesGuard: Role not assigned to user in DB', {
        userId,
        currentRole,
      });
      require('fs').appendFileSync(
        'roles-debug.log',
        `[${new Date().toISOString()}] No DB Role: ${userId} ${currentRole}\n`,
      );
      throw new ForbiddenException(
        'Vai trò hiện tại không còn được gán cho tài khoản. Vui lòng đăng nhập lại.',
      );
    }

    // Authorize only the verified active role, never another assigned role.
    if (requiredRoles && !requiredRoles.includes(currentRole)) {
      console.error('RolesGuard: Role mismatch', {
        requiredRoles,
        currentRole,
      });
      require('fs').appendFileSync(
        'roles-debug.log',
        `[${new Date().toISOString()}] Mismatch: ${currentRole} vs ${requiredRoles}\n`,
      );
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}. Current role: ${currentRole}`,
      );
    }

    require('fs').appendFileSync(
      'roles-debug.log',
      `[${new Date().toISOString()}] Auth Success: ${currentRole}\n`,
    );
    return true;
  }
}

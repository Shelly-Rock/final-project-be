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
    sub: number;
    role: string;
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

    if (
      !user ||
      !Number.isInteger(user.sub) ||
      user.sub <= 0 ||
      !user.role?.trim()
    ) {
      throw new ForbiddenException('User not authenticated');
    }

    const currentRole = user.role;

    // The JWT role only identifies the active role. A token minted before the
    // account or assignment was disabled must not retain authorization.
    const assigned = await this.prisma.userRole.findFirst({
      where: {
        user_id: user.sub,
        user: { is_active: true, deleted_at: null },
        role: { name: currentRole, deleted_at: null },
      },
      select: { role_id: true },
    });

    if (!assigned) {
      throw new ForbiddenException(
        'Vai trò hiện tại không còn được gán cho tài khoản. Vui lòng đăng nhập lại.',
      );
    }

    // Authorize only the verified active role, never another assigned role.
    if (requiredRoles && !requiredRoles.includes(currentRole)) {
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}. Current role: ${currentRole}`,
      );
    }

    return true;
  }
}

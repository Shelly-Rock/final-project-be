import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma/prisma.service';

const permissionData = [
  ['role:read', 'Xem role', 'role', 'read'],
  ['role:create', 'Tạo role', 'role', 'create'],
  ['role:update', 'Cập nhật role', 'role', 'update'],
  ['role:delete', 'Xóa role', 'role', 'delete'],
  ['user:read', 'Xem user', 'user', 'read'],
  ['user:create', 'Tạo user', 'user', 'create'],
  ['user:update', 'Cập nhật user', 'user', 'update'],
  ['user:delete', 'Xóa user', 'user', 'delete'],
  ['student:read', 'Xem sinh viên', 'student', 'read'],
  ['student:create', 'Tạo sinh viên', 'student', 'create'],
  ['student:update', 'Cập nhật sinh viên', 'student', 'update'],
  ['student:delete', 'Xóa sinh viên', 'student', 'delete'],
  ['teacher:read', 'Xem giảng viên', 'teacher', 'read'],
  ['teacher:create', 'Tạo giảng viên', 'teacher', 'create'],
  ['teacher:update', 'Cập nhật giảng viên', 'teacher', 'update'],
  ['teacher:delete', 'Xóa giảng viên', 'teacher', 'delete'],
] as const;

const rolePermissions: Record<string, string[]> = {
  ADMIN: permissionData.map(([name]) => name),
  SECRETARY: [
    'user:read',
    'user:create',
    'user:update',
    'student:read',
    'student:create',
    'student:update',
    'student:delete',
    'teacher:read',
  ],
  TEACHER: ['student:read'],
  STUDENT: ['student:read'],
  COMMITTEE: ['student:read'],
};

@Injectable()
export class RbacSyncService implements OnModuleInit {
  private readonly logger = new Logger(RbacSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const permissions = new Map<string, number>();

    for (const [name, description, module, action] of permissionData) {
      const permission = await this.prisma.permission.upsert({
        where: { name },
        update: { description, module, action },
        create: { name, description, module, action },
      });
      permissions.set(permission.name, permission.id);
    }

    for (const [roleName, names] of Object.entries(rolePermissions)) {
      const role = await this.prisma.role.findUnique({
        where: { name: roleName },
        select: { id: true },
      });
      if (!role) continue;

      for (const name of names) {
        const permissionId = permissions.get(name);
        if (!permissionId) continue;
        await this.prisma.rolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: role.id,
              permission_id: permissionId,
            },
          },
          update: {},
          create: { role_id: role.id, permission_id: permissionId },
        });
      }
    }

    this.logger.log('RBAC permissions synchronized');
  }
}

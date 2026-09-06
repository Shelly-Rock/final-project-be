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

@Injectable()
export class RbacSyncService implements OnModuleInit {
  private readonly logger = new Logger(RbacSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // Only sync the permission catalog. Default role <-> permission grants
    // are managed by the seed script / admin UI and must NOT be overwritten
    // here, otherwise admin edits made via the permission matrix would be
    // silently reverted on every server restart.
    for (const [name, description, module, action] of permissionData) {
      await this.prisma.permission.upsert({
        where: { name },
        update: { description, module, action },
        create: { name, description, module, action },
      });
    }

    this.logger.log('RBAC permission catalog synchronized');
  }
}

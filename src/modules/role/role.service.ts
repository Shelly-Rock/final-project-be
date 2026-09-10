import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntityType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { CreateRoleDto, UpdateRoleDto, RoleResponseDto } from './dto';

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: { permissions: { include: { permission: true } } };
}>;

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private snapshot(role: RoleWithPermissions) {
    return {
      id: role.id,
      name: role.name,
      display_name: role.display_name,
      description: role.description,
      is_system: role.is_system,
      priority: role.priority,
      permission_ids: role.permissions.map(({ permission }) => permission.id),
    };
  }

  async create(
    createRoleDto: CreateRoleDto,
    actorUserId: number,
  ): Promise<RoleResponseDto> {
    const existingRole = await this.prisma.role.findUnique({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new ConflictException(`Role '${createRoleDto.name}' đã tồn tại`);
    }

    const role = await this.prisma.role.create({
      data: {
        name: createRoleDto.name,
        display_name: createRoleDto.display_name,
        description: createRoleDto.description,
        is_system: createRoleDto.is_system ?? false,
        priority: createRoleDto.priority ?? 0,
        ...(createRoleDto.permission_ids && {
          permissions: {
            create: createRoleDto.permission_ids.map((permission_id) => ({
              permission: { connect: { id: permission_id } },
            })),
          },
        }),
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.audit.writeAudit(this.prisma, {
      actor_user_id: actorUserId,
      action: AuditAction.CREATE,
      entity_type: AuditEntityType.ROLE,
      entity_id: role.id,
      after_data: this.snapshot(role),
      reason: `Tạo role '${role.name}'.`,
    });

    return this.toResponse(role);
  }

  async findAll(options?: {
    includeDeleted?: boolean;
  }): Promise<RoleResponseDto[]> {
    const roles = await this.prisma.role.findMany({
      where: options?.includeDeleted ? {} : { deleted_at: null },
      include: { permissions: { include: { permission: true } } },
      orderBy: { priority: 'desc' },
    });

    return roles.map((role) => this.toResponse(role));
  }

  async findOne(id: number): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role || role.deleted_at) {
      throw new NotFoundException(`Role với ID ${id} không tìm thấy`);
    }

    return this.toResponse(role);
  }

  async findByName(name: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { name },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role || role.deleted_at) {
      throw new NotFoundException(`Role '${name}' không tìm thấy`);
    }

    return this.toResponse(role);
  }

  async update(
    id: number,
    updateRoleDto: UpdateRoleDto,
    actorUserId: number,
  ): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role || role.deleted_at) {
      throw new NotFoundException(`Role với ID ${id} không tìm thấy`);
    }

    if (role.is_system) {
      throw new BadRequestException('Không thể cập nhật role hệ thống');
    }

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: {
        ...(updateRoleDto.display_name && {
          display_name: updateRoleDto.display_name,
        }),
        ...(updateRoleDto.description !== undefined && {
          description: updateRoleDto.description,
        }),
        ...(updateRoleDto.priority !== undefined && {
          priority: updateRoleDto.priority,
        }),
        ...(updateRoleDto.permission_ids && {
          permissions: {
            set: updateRoleDto.permission_ids.map((permission_id) => ({
              role_id_permission_id: { role_id: id, permission_id },
            })),
          },
        }),
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.audit.writeAudit(this.prisma, {
      actor_user_id: actorUserId,
      action: AuditAction.UPDATE,
      entity_type: AuditEntityType.ROLE,
      entity_id: id,
      before_data: this.snapshot(role),
      after_data: this.snapshot(updatedRole),
      reason: `Cập nhật role '${role.name}'.`,
    });

    return this.toResponse(updatedRole);
  }

  async remove(
    id: number,
    actorUserId: number,
    hardDelete = false,
  ): Promise<{ success: boolean; message: string }> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { user_roles: true },
    });

    if (!role || role.deleted_at) {
      throw new NotFoundException(`Role với ID ${id} không tìm thấy`);
    }

    if (role.is_system) {
      throw new BadRequestException('Không thể xóa role hệ thống');
    }

    if (role.user_roles.length > 0) {
      throw new ConflictException(
        `Role đang được sử dụng bởi ${role.user_roles.length} user(s). Không thể xóa.`,
      );
    }

    if (hardDelete) {
      await this.prisma.role.delete({ where: { id } });
      await this.audit.writeAudit(this.prisma, {
        actor_user_id: actorUserId,
        action: AuditAction.DELETE,
        entity_type: AuditEntityType.ROLE,
        entity_id: id,
        before_data: { id: role.id, name: role.name },
        reason: `Xóa vĩnh viễn role '${role.name}'.`,
      });
      return { success: true, message: `Đã xóa vĩnh viễn role '${role.name}'` };
    }

    await this.prisma.role.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.audit.writeAudit(this.prisma, {
      actor_user_id: actorUserId,
      action: AuditAction.DELETE,
      entity_type: AuditEntityType.ROLE,
      entity_id: id,
      before_data: { id: role.id, name: role.name },
      after_data: { deleted_at: new Date().toISOString() },
      reason: `Xóa mềm role '${role.name}'.`,
    });

    return { success: true, message: `Đã xóa mềm role '${role.name}'` };
  }

  async restore(
    id: number,
    actorUserId: number,
  ): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`Role với ID ${id} không tìm thấy`);
    }

    if (!role.deleted_at) {
      throw new BadRequestException('Role chưa bị xóa');
    }

    const restoredRole = await this.prisma.role.update({
      where: { id },
      data: { deleted_at: null },
      include: { permissions: { include: { permission: true } } },
    });

    await this.audit.writeAudit(this.prisma, {
      actor_user_id: actorUserId,
      action: AuditAction.UPDATE,
      entity_type: AuditEntityType.ROLE,
      entity_id: id,
      before_data: { id: role.id, name: role.name, deleted_at: role.deleted_at.toISOString() },
      after_data: this.snapshot(restoredRole),
      reason: `Khôi phục role '${role.name}'.`,
    });

    return this.toResponse(restoredRole);
  }

  async assignPermissions(
    roleId: number,
    permissionIds: number[],
    actorUserId: number,
  ): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role || role.deleted_at) {
      throw new NotFoundException(`Role với ID ${roleId} không tìm thấy`);
    }

    // Dedupe + only accept existing, non-deleted permissions
    const uniquePermissionIds = [...new Set(permissionIds)];

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: uniquePermissionIds }, deleted_at: null },
    });

    if (permissions.length !== uniquePermissionIds.length) {
      throw new BadRequestException('Một số permission ID không hợp lệ');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role_id: roleId } });
      await tx.rolePermission.createMany({
        data: uniquePermissionIds.map((permission_id) => ({
          role_id: roleId,
          permission_id,
        })),
      });
    });

    const updatedRole = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });

    await this.audit.writeAudit(this.prisma, {
      actor_user_id: actorUserId,
      action: AuditAction.ASSIGN,
      entity_type: AuditEntityType.ROLE,
      entity_id: roleId,
      before_data: { permission_ids: role.permissions.map(({ permission }) => permission.id) },
      after_data: { permission_ids: uniquePermissionIds },
      reason: `Gán permissions cho role '${role.name}'.`,
    });

    return this.toResponse(updatedRole as RoleWithPermissions);
  }

  async getPermissions(roleId: number) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role) {
      throw new NotFoundException(`Role với ID ${roleId} không tìm thấy`);
    }

    return role.permissions.map(({ permission }) => permission);
  }

  async getUserRoles(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_roles: { include: { role: true } },
      },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException(`User với ID ${userId} không tìm thấy`);
    }

    return user.user_roles
      .map(({ role }) => role)
      .sort((a, b) => b.priority - a.priority);
  }

  async assignUserRoles(
    userId: number,
    roleIds: number[],
    actorUserId: number,
  ) {
    const uniqueRoleIds = [...new Set(roleIds)];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { user_roles: { include: { role: true } } },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException(`User với ID ${userId} không tìm thấy`);
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: uniqueRoleIds }, deleted_at: null },
    });

    if (roles.length !== uniqueRoleIds.length) {
      throw new BadRequestException('Một số role ID không hợp lệ');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { user_id: userId } });
      await tx.userRole.createMany({
        data: uniqueRoleIds.map((role_id) => ({
          user_id: userId,
          role_id,
        })),
      });
    });

    await this.audit.writeAudit(this.prisma, {
      actor_user_id: actorUserId,
      action: AuditAction.ASSIGN,
      entity_type: AuditEntityType.USER,
      entity_id: userId,
      before_data: { role_ids: user.user_roles.map(({ role }) => role.id) },
      after_data: { role_ids: uniqueRoleIds },
      reason: `Gán roles cho user '${user.email}'.`,
    });

    return this.getUserRoles(userId);
  }

  async listUsersWithRoles(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {
      deleted_at: null,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: 'insensitive' } },
              { username: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { user_roles: { include: { role: true } } },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        is_active: u.is_active,
        roles: u.user_roles
          .map(({ role }) => role)
          .sort((a, b) => b.priority - a.priority),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private toResponse(role: RoleWithPermissions): RoleResponseDto {
    return new RoleResponseDto({
      ...role,
      permissions: role.permissions.map(({ permission }) => permission),
    });
  }
}

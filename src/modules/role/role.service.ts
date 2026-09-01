import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto, RoleResponseDto } from './dto';

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: { permissions: { include: { permission: true } } };
}>;

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto): Promise<RoleResponseDto> {
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
  ): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
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

    return this.toResponse(updatedRole);
  }

  async remove(
    id: number,
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
      return { success: true, message: `Đã xóa vĩnh viễn role '${role.name}'` };
    }

    await this.prisma.role.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return { success: true, message: `Đã xóa mềm role '${role.name}'` };
  }

  async restore(id: number): Promise<RoleResponseDto> {
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

    return this.toResponse(restoredRole);
  }

  async assignPermissions(
    roleId: number,
    permissionIds: number[],
  ): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role với ID ${roleId} không tìm thấy`);
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('Một số permission ID không hợp lệ');
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        permissions: {
          set: permissionIds.map((permission_id) => ({
            role_id_permission_id: { role_id: roleId, permission_id },
          })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    return this.toResponse(updatedRole);
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

  async assignUserRoles(userId: number, roleIds: number[]) {
    const uniqueRoleIds = [...new Set(roleIds)];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    return this.getUserRoles(userId);
  }

  private toResponse(role: RoleWithPermissions): RoleResponseDto {
    return new RoleResponseDto({
      ...role,
      permissions: role.permissions.map(({ permission }) => permission),
    });
  }
}

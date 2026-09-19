import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { AuditAction, AuditEntityType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserReqDTO } from './dto/request/createUserREQ.dto';
import { UpdateUserReqDTO } from './dto/request/updateUserREQ.dto';
import { UserRespDTO } from './dto/response/userRESP.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateUserReqDTO,
    actorUserId: number,
  ): Promise<UserRespDTO> {
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException(`Username "${dto.username}" đã tồn tại.`);
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException(`Email "${dto.email}" đã tồn tại.`);
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          password_hash,
          is_active: true,
          must_change_password: true,
        },
        include: {
          user_roles: {
            include: {
              role: { select: { id: true, name: true, display_name: true } },
            },
          },
        },
      });

      if (dto.role_ids && dto.role_ids.length > 0) {
        const uniqueRoleIds = Array.from(new Set(dto.role_ids));
        await tx.userRole.createMany({
          data: uniqueRoleIds.map((role_id) => ({
            user_id: created.id,
            role_id,
          })),
          skipDuplicates: true,
        });
      }

      const userWithRoles = await tx.user.findUnique({
        where: { id: created.id },
        include: {
          user_roles: {
            include: {
              role: { select: { id: true, name: true, display_name: true } },
            },
          },
        },
      });

      await this.audit.writeAudit(tx, {
        actor_user_id: actorUserId,
        action: AuditAction.CREATE,
        entity_type: AuditEntityType.USER,
        entity_id: created.id,
        after_data: this.snapshot(userWithRoles),
      });

      return userWithRoles;
    });

    return this.toResponse(user);
  }

  async update(
    id: number,
    dto: UpdateUserReqDTO,
    actorUserId: number,
  ): Promise<UserRespDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        user_roles: {
          include: {
            role: { select: { id: true, name: true, display_name: true } },
          },
        },
      },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException(`User ID ${id} không tồn tại.`);
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Email "${dto.email}" đã được sử dụng bởi user khác.`,
        );
      }
    }

    const beforeSnapshot = this.snapshot(user);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (dto.email !== undefined) updateData.email = dto.email;
      if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
      if (dto.must_change_password !== undefined)
        updateData.must_change_password = dto.must_change_password;
      if (dto.password) {
        updateData.password_hash = await bcrypt.hash(dto.password, 10);
      }

      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
        include: {
          user_roles: {
            include: {
              role: { select: { id: true, name: true, display_name: true } },
            },
          },
        },
      });

      if (dto.role_ids !== undefined) {
        await tx.userRole.deleteMany({ where: { user_id: id } });
        if (dto.role_ids.length > 0) {
          const uniqueRoleIds = Array.from(new Set(dto.role_ids));
          await tx.userRole.createMany({
            data: uniqueRoleIds.map((role_id) => ({ user_id: id, role_id })),
            skipDuplicates: true,
          });
        }
      }

      const userWithRoles = await tx.user.findUnique({
        where: { id },
        include: {
          user_roles: {
            include: {
              role: { select: { id: true, name: true, display_name: true } },
            },
          },
        },
      });

      await this.audit.writeAudit(tx, {
        actor_user_id: actorUserId,
        action: AuditAction.UPDATE,
        entity_type: AuditEntityType.USER,
        entity_id: id,
        before_data: beforeSnapshot,
        after_data: this.snapshot(userWithRoles),
      });

      return userWithRoles;
    });

    return this.toResponse(updated);
  }

  async remove(id: number, actorUserId: number): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deleted_at) {
      throw new NotFoundException(`User ID ${id} không tồn tại.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deleted_at: new Date() },
      });

      await this.audit.writeAudit(tx, {
        actor_user_id: actorUserId,
        action: AuditAction.DELETE,
        entity_type: AuditEntityType.USER,
        entity_id: id,
        after_data: { deleted_at: new Date().toISOString() },
      });
    });

    return { message: `User ID ${id} đã bị xóa (soft delete).` };
  }

  async restore(id: number, actorUserId: number): Promise<UserRespDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        user_roles: {
          include: {
            role: { select: { id: true, name: true, display_name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ID ${id} không tồn tại.`);
    }
    if (!user.deleted_at) {
      throw new BadRequestException(`User ID ${id} chưa bị xóa.`);
    }

    const restored = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { deleted_at: null },
        include: {
          user_roles: {
            include: {
              role: { select: { id: true, name: true, display_name: true } },
            },
          },
        },
      });

      await this.audit.writeAudit(tx, {
        actor_user_id: actorUserId,
        action: AuditAction.UPDATE,
        entity_type: AuditEntityType.USER,
        entity_id: id,
        before_data: { deleted_at: user.deleted_at.toISOString() },
        after_data: this.snapshot(updated),
        reason: 'Khôi phục user đã xóa',
      });

      return updated;
    });

    return this.toResponse(restored);
  }

  async findAll(page = 1, limit = 20, includeDeleted = false) {
    const skip = (page - 1) * limit;
    const where = includeDeleted ? {} : { deleted_at: null };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          user_roles: {
            include: {
              role: { select: { id: true, name: true, display_name: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u) => this.toResponse(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<UserRespDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        user_roles: {
          include: {
            role: { select: { id: true, name: true, display_name: true } },
          },
        },
      },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException(`User ID ${id} không tồn tại.`);
    }

    return this.toResponse(user);
  }

  private snapshot(user: any) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      is_active: user.is_active,
      must_change_password: user.must_change_password,
      email_verified_at: user.email_verified_at?.toISOString() ?? null,
      role_ids: user.user_roles?.map((ur: any) => ur.role_id) ?? [],
    };
  }

  private toResponse(user: any): UserRespDTO {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      is_active: user.is_active,
      must_change_password: user.must_change_password,
      email_verified_at: user.email_verified_at?.toISOString() ?? null,
      created_at: user.created_at.toISOString(),
      updated_at: user.updated_at.toISOString(),
      deleted_at: user.deleted_at?.toISOString() ?? null,
      roles:
        user.user_roles?.map((ur: any) => ({
          role_id: ur.role.id,
          role_name: ur.role.name,
          role_display_name: ur.role.display_name,
        })) ?? [],
    };
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserReqDTO } from './dto/request/createUserREQ.dto';
import { UpdateUserReqDTO } from './dto/request/updateUserREQ.dto';
import { UserRespDTO } from './dto/response/userRESP.dto';
import { CreateSecretaryReqDTO } from './dto/request/createSecretaryREQ.dto';
import { UpdateSecretaryReqDTO } from './dto/request/updateSecretaryREQ.dto';
import { SecretaryAccountRespDTO } from './dto/response/secretaryAccountRESP.dto';

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

    if (dto.role_ids?.length) {
      const secretaryRole = await this.prisma.role.findUnique({
        where: { name: 'SECRETARY' },
        select: { id: true },
      });
      if (secretaryRole && dto.role_ids.includes(secretaryRole.id)) {
        throw new BadRequestException(
          'Hãy tạo tài khoản thư ký qua /users/secretaries để gán khoa bắt buộc.',
        );
      }
    }

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

    if (dto.role_ids !== undefined) {
      await this.assertSecretaryRoleAssignment(id, dto.role_ids);
    }

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

  /**
   * Provision secretary accounts directly. This deliberately skips the
   * student/teacher registration and Gmail verification flows.
   */
  async createSecretary(
    dto: CreateSecretaryReqDTO,
    actorUserId: number,
  ): Promise<SecretaryAccountRespDTO> {
    const username = dto.username.trim();
    const facultyId = dto.faculty_id.trim();
    const secretaryId = (dto.secretary_id?.trim() || username).trim();
    const email =
      dto.email?.trim() ||
      `${username.toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'secretary'}@local.invalid`;

    const [existingUsername, existingEmail, existingSecretary, faculty, role] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { username } }),
        this.prisma.user.findUnique({ where: { email } }),
        this.prisma.secretary.findUnique({ where: { secretary_id: secretaryId } }),
        this.prisma.faculty.findUnique({ where: { id: facultyId } }),
        this.prisma.role.findUnique({ where: { name: 'SECRETARY' } }),
      ]);

    if (existingUsername) {
      throw new ConflictException(`Username "${username}" đã tồn tại.`);
    }
    if (existingEmail) {
      throw new ConflictException(`Email "${email}" đã tồn tại.`);
    }
    if (existingSecretary) {
      throw new ConflictException(`Mã thư ký "${secretaryId}" đã tồn tại.`);
    }
    if (!faculty || !faculty.is_active) {
      throw new BadRequestException(`Khoa "${facultyId}" không tồn tại hoặc đã ngừng hoạt động.`);
    }
    if (!role || role.deleted_at) {
      throw new BadRequestException('Role SECRETARY chưa được cấu hình.');
    }

    const occupiedFaculty = await this.prisma.secretary.findUnique({
      where: { faculty_id: facultyId },
      select: { id: true, deleted_at: true },
    });
    if (occupiedFaculty) {
      throw new ConflictException(`Khoa "${facultyId}" đã có thư ký. Mỗi khoa chỉ được gán một thư ký.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let secretary;
    try {
      secretary = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            email,
            password_hash: passwordHash,
            is_active: true,
            // Provisioned accounts are usable immediately; no Gmail link is sent.
            email_verified_at: new Date(),
            must_change_password: false,
            user_roles: { create: [{ role_id: role.id }] },
          },
        });

        const created = await tx.secretary.create({
          data: {
            user_id: user.id,
            secretary_id: secretaryId,
            faculty_id: facultyId,
          },
          include: { user: true, faculty: true },
        });

        await this.audit.writeAudit(tx, {
          actor_user_id: actorUserId,
          action: AuditAction.CREATE,
          entity_type: AuditEntityType.USER,
          entity_id: user.id,
          after_data: this.secretarySnapshot(created),
          reason: `Tạo tài khoản thư ký "${username}" và gán khoa "${facultyId}".`,
        });

        return created;
      });
    } catch (error) {
      this.throwSecretaryConstraintConflict(error);
    }

    return this.toSecretaryResponse(secretary);
  }

  async findSecretaries(
    page = 1,
    limit = 20,
    includeDeleted = false,
    facultyId?: string,
    search?: string,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;
    const trimmedSearch = search?.trim();
    const where: Prisma.SecretaryWhereInput = {
      ...(includeDeleted ? {} : { deleted_at: null, user: { deleted_at: null } }),
      ...(facultyId?.trim() ? { faculty_id: facultyId.trim() } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { secretary_id: { contains: trimmedSearch, mode: 'insensitive' } },
              {
                user: {
                  OR: [
                    { username: { contains: trimmedSearch, mode: 'insensitive' } },
                    { email: { contains: trimmedSearch, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.secretary.findMany({
        where,
        include: { user: true, faculty: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.secretary.count({ where }),
    ]);

    return {
      data: data.map((secretary) => this.toSecretaryResponse(secretary)),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findSecretary(id: number): Promise<SecretaryAccountRespDTO> {
    const secretary = await this.prisma.secretary.findUnique({
      where: { id },
      include: { user: true, faculty: true },
    });
    if (!secretary || secretary.deleted_at || secretary.user.deleted_at) {
      throw new NotFoundException(`Thư ký ID ${id} không tồn tại.`);
    }
    return this.toSecretaryResponse(secretary);
  }

  async updateSecretary(
    id: number,
    dto: UpdateSecretaryReqDTO,
    actorUserId: number,
  ): Promise<SecretaryAccountRespDTO> {
    const secretary = await this.prisma.secretary.findUnique({
      where: { id },
      include: { user: true, faculty: true },
    });
    if (!secretary || secretary.deleted_at || secretary.user.deleted_at) {
      throw new NotFoundException(`Thư ký ID ${id} không tồn tại.`);
    }

    const nextFacultyId = dto.faculty_id?.trim();
    const nextSecretaryId = dto.secretary_id?.trim();
    const nextEmail = dto.email?.trim();

    if (nextFacultyId && nextFacultyId !== secretary.faculty_id) {
      const faculty = await this.prisma.faculty.findUnique({ where: { id: nextFacultyId } });
      if (!faculty || !faculty.is_active) {
        throw new BadRequestException(`Khoa "${nextFacultyId}" không tồn tại hoặc đã ngừng hoạt động.`);
      }
      const occupied = await this.prisma.secretary.findUnique({
        where: { faculty_id: nextFacultyId },
        select: { id: true },
      });
      if (occupied && occupied.id !== id) {
        throw new ConflictException(`Khoa "${nextFacultyId}" đã có thư ký. Mỗi khoa chỉ được gán một thư ký.`);
      }
    }
    if (nextSecretaryId && nextSecretaryId !== secretary.secretary_id) {
      const duplicate = await this.prisma.secretary.findUnique({
        where: { secretary_id: nextSecretaryId },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(`Mã thư ký "${nextSecretaryId}" đã tồn tại.`);
      }
    }
    if (nextEmail && nextEmail !== secretary.user.email) {
      const duplicate = await this.prisma.user.findUnique({ where: { email: nextEmail } });
      if (duplicate && duplicate.id !== secretary.user_id) {
        throw new ConflictException(`Email "${nextEmail}" đã tồn tại.`);
      }
    }

    const before = this.secretarySnapshot(secretary);
    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: secretary.user_id },
          data: {
            ...(nextEmail ? { email: nextEmail } : {}),
            ...(dto.password
              ? { password_hash: await bcrypt.hash(dto.password, 10) }
              : {}),
            ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
            ...(dto.must_change_password !== undefined
              ? { must_change_password: dto.must_change_password }
              : {}),
          },
        });
        const result = await tx.secretary.update({
          where: { id },
          data: {
            ...(nextFacultyId ? { faculty_id: nextFacultyId } : {}),
            ...(nextSecretaryId ? { secretary_id: nextSecretaryId } : {}),
          },
          include: { user: true, faculty: true },
        });
        await this.audit.writeAudit(tx, {
          actor_user_id: actorUserId,
          action: AuditAction.UPDATE,
          entity_type: AuditEntityType.USER,
          entity_id: secretary.user_id,
          before_data: before,
          after_data: this.secretarySnapshot(result),
          reason: `Cập nhật tài khoản thư ký "${secretary.user.username}".`,
        });
        return result;
      });
    } catch (error) {
      this.throwSecretaryConstraintConflict(error);
    }

    return this.toSecretaryResponse(updated);
  }

  async removeSecretary(id: number, actorUserId: number): Promise<{ message: string }> {
    const secretary = await this.prisma.secretary.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!secretary || secretary.deleted_at || secretary.user.deleted_at) {
      throw new NotFoundException(`Thư ký ID ${id} không tồn tại.`);
    }
    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.secretary.update({
        where: { id },
        // Release the faculty's unique slot while keeping the account recoverable.
        data: { deleted_at: deletedAt, faculty_id: null },
      });
      await tx.user.update({
        where: { id: secretary.user_id },
        data: { deleted_at: deletedAt, is_active: false },
      });
      await this.audit.writeAudit(tx, {
        actor_user_id: actorUserId,
        action: AuditAction.DELETE,
        entity_type: AuditEntityType.USER,
        entity_id: secretary.user_id,
        before_data: this.secretarySnapshot(secretary),
        after_data: { deleted_at: deletedAt.toISOString(), faculty_id: null },
        reason: `Xóa tài khoản thư ký "${secretary.user.username}".`,
      });
    });
    return { message: `Đã xóa tài khoản thư ký ID ${id}.` };
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

  private async assertSecretaryRoleAssignment(
    userId: number,
    roleIds: number[],
  ): Promise<void> {
    const secretaryRole = await this.prisma.role.findUnique({
      where: { name: 'SECRETARY' },
      select: { id: true },
    });
    if (!secretaryRole) return;

    const wantsSecretary = roleIds.includes(secretaryRole.id);
    const profile = await this.prisma.secretary.findUnique({
      where: { user_id: userId },
      select: { faculty_id: true, deleted_at: true },
    });

    if (wantsSecretary && (!profile || profile.deleted_at || !profile.faculty_id)) {
      throw new BadRequestException(
        'Tài khoản SECRETARY phải có hồ sơ thư ký gắn với một khoa. Hãy dùng /users/secretaries.',
      );
    }
    if (profile && !profile.deleted_at && profile.faculty_id && !wantsSecretary) {
      throw new BadRequestException(
        'Không thể gỡ role SECRETARY khỏi tài khoản đang được gắn với một khoa.',
      );
    }
  }

  private secretarySnapshot(secretary: any) {
    return {
      id: secretary.id,
      user_id: secretary.user_id,
      secretary_id: secretary.secretary_id,
      username: secretary.user?.username ?? null,
      email: secretary.user?.email ?? null,
      faculty_id: secretary.faculty_id ?? null,
      faculty_name: secretary.faculty?.name ?? null,
      is_active: secretary.user?.is_active ?? false,
      deleted_at: secretary.deleted_at?.toISOString() ?? null,
    };
  }

  private throwSecretaryConstraintConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Tài khoản, mã thư ký hoặc khoa đã được gán cho bản ghi khác.',
      );
    }
    throw error;
  }

  private toSecretaryResponse(secretary: any): SecretaryAccountRespDTO {
    return {
      id: secretary.id,
      user_id: secretary.user_id,
      secretary_id: secretary.secretary_id,
      username: secretary.user.username,
      email: secretary.user.email,
      is_active: secretary.user.is_active,
      must_change_password: secretary.user.must_change_password,
      email_verified_at: secretary.user.email_verified_at?.toISOString() ?? null,
      faculty_id: secretary.faculty_id,
      faculty_name: secretary.faculty?.name ?? null,
      created_at: secretary.created_at.toISOString(),
      updated_at: secretary.updated_at.toISOString(),
      deleted_at: secretary.deleted_at?.toISOString() ?? null,
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

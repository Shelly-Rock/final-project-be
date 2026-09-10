import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { AuditQueryDto } from './audit.dto';

type Tx = Prisma.TransactionClient;

export interface WriteAuditParams {
  actor_user_id: number;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: number;
  before_data?: any;
  after_data?: any;
  reason?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ghi audit log. Không throw error để không phá business logic.
   * Nếu audit fail thì chỉ log error và tiếp tục.
   */
  async writeAudit(
    txOrPrisma: Tx | PrismaService,
    params: WriteAuditParams,
  ): Promise<void> {
    try {
      await txOrPrisma.audit_logs.create({
        data: {
          actor_user_id: params.actor_user_id,
          action: params.action,
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          before_data: params.before_data
            ? (params.before_data as Prisma.InputJsonValue)
            : null,
          after_data: params.after_data
            ? (params.after_data as Prisma.InputJsonValue)
            : null,
          reason: params.reason ?? null,
        },
      });
    } catch (error) {
      // Audit không được phá business logic
      this.logger.error(
        `Failed to write audit log for ${params.entity_type}:${params.entity_id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async getLogs(query: AuditQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.audit_logsWhereInput = {};
    if (query.entity_type) where.entity_type = query.entity_type;
    if (query.entity_id) where.entity_id = query.entity_id;
    if (query.actor_user_id) where.actor_user_id = query.actor_user_id;
    if (query.action) where.action = query.action;
    if (query.from || query.to) {
      where.created_at = {};
      if (query.from) where.created_at.gte = new Date(query.from);
      if (query.to) where.created_at.lte = new Date(query.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        include: {
          actor: { select: { id: true, username: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.audit_logs.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

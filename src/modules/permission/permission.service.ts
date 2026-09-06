import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma/prisma.service';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.permission.findMany({
      where: { deleted_at: null },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }
}

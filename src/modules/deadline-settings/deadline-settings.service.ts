import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IsString, IsOptional, IsBoolean, IsDate, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDeadlineDto {
  @ApiProperty({ example: 'Đăng ký đề tài HK2 2024-2025' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: '2025-01-15T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({ example: '2025-06-30T23:59:59Z' })
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiPropertyOptional({ default: 3, description: 'Warning days before deadline' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  warningDays?: number;
}

export class UpdateDeadlineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  warningDays?: number;
}

@Injectable()
export class DeadlineSettingsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateDeadlineDto) {
    return this.prisma.deadlineSetting.create({
      data,
    });
  }

  async findAll(params?: { isActive?: boolean }) {
    const where: any = {};
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    return this.prisma.deadlineSetting.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const deadline = await this.prisma.deadlineSetting.findUnique({
      where: { id },
    });

    if (!deadline) {
      throw new NotFoundException(`Deadline with ID ${id} not found`);
    }

    return deadline;
  }

  async findActive() {
    return this.prisma.deadlineSetting.findMany({
      where: { isActive: true },
      orderBy: { startDate: 'asc' },
    });
  }

  async update(id: string, data: UpdateDeadlineDto) {
    const deadline = await this.prisma.deadlineSetting.findUnique({ where: { id } });

    if (!deadline) {
      throw new NotFoundException(`Deadline with ID ${id} not found`);
    }

    return this.prisma.deadlineSetting.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const deadline = await this.prisma.deadlineSetting.findUnique({ where: { id } });

    if (!deadline) {
      throw new NotFoundException(`Deadline with ID ${id} not found`);
    }

    await this.prisma.deadlineSetting.delete({ where: { id } });
    return { message: 'Deadline deleted successfully' };
  }

  async checkUpcomingDeadlines() {
    const now = new Date();
    const deadlines = await this.prisma.deadlineSetting.findMany({
      where: {
        isActive: true,
        endDate: { gte: now },
      },
    });

    const results = [];

    for (const deadline of deadlines) {
      const warningDate = new Date(deadline.endDate.getTime() - deadline.warningDays * 24 * 60 * 60 * 1000);
      
      if (now >= warningDate) {
        const daysRemaining = Math.ceil((deadline.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        results.push({
          ...deadline,
          daysRemaining,
          isUrgent: daysRemaining <= deadline.warningDays,
        });
      }
    }

    return results;
  }
}

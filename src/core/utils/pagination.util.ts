import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';

@Injectable()
export class PaginationService {
  constructor(private prisma: PrismaService) {}

  async paginate<T>(
    model: any,
    where: any,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      include?: any;
      select?: any;
    },
  ): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      model.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: options.include,
        select: options.select,
      }),
      model.count({ where }),
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

// Export standalone functions for compatibility
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export const getPaginationOptions = (
  page: number = 1,
  pageSize: number = 10,
) => {
  const take = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const skip = (Number(page) - 1 > 0 ? Number(page) - 1 : 0) * take;
  return { take, skip };
};

export const formatPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number = 1,
  pageSize: number = 10,
) => {
  const totalPages = Math.ceil(total / pageSize);
  return {
    data,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages,
  };
};

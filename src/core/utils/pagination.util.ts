export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export const getPaginationOptions = (page: number = 1, pageSize: number = 10) => {
  const take = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const skip = (Number(page) - 1 > 0 ? Number(page) - 1 : 0) * take;
  return { take, skip };
};

export const formatPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number = 1,
  pageSize: number = 10
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
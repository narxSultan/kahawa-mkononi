export function normalizePagination(input?: { page?: number | null; pageSize?: number | null } | null) {
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 20));
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return { page, pageSize, skip, take };
}

export function pageInfo(args: { page: number; pageSize: number; total: number }) {
  const { page, pageSize, total } = args;
  return {
    page,
    pageSize,
    total,
    hasNextPage: page * pageSize < total
  };
}


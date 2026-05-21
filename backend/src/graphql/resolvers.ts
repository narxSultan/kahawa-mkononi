import { CentreStatus, DutyPriority, DutyStatus, HandoverStatus, NotificationType, OrderStatus, Prisma, RoleName, StockMovementType, UserStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { RequestContext } from "../auth/requestContext.js";
import { assertAnyRole, assertAuthenticated, isAdmin, isManager } from "../auth/rbac.js";
import { assertManagerOrDelegated, delegatedPermissionCodes } from "../auth/delegation.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAccessToken, signRefreshToken, verifyToken, type JwtUser } from "../auth/jwt.js";
import { normalizePagination, pageInfo } from "./pagination.js";
import { DateTimeScalar, DecimalScalar } from "./scalars.js";
import { logActivity } from "../activity/activityLog.js";

const orderInclude = {
  customer: true,
  serviceCentre: true,
  items: { include: { product: true } }
} as const;

function mustHaveCentre(ctx: RequestContext) {
  if (!ctx.user?.serviceCentreId) throw new Error("SERVICE_CENTRE_REQUIRED");
  return ctx.user.serviceCentreId;
}

function enforceCentreScope(ctx: RequestContext, requestedCentreId?: string | null) {
  if (isAdmin(ctx)) return requestedCentreId ?? null;
  const centreId = mustHaveCentre(ctx);
  if (requestedCentreId && requestedCentreId !== centreId) throw new Error("FORBIDDEN");
  return centreId;
}

function enforceManagerCentre(ctx: RequestContext) {
  if (!ctx.user?.serviceCentreId) throw new Error("SERVICE_CENTRE_REQUIRED");
  return ctx.user.serviceCentreId;
}

function assertUserNotDeleted(u: { status: UserStatus; deletedAt: Date | null }) {
  if (u.status === UserStatus.DELETED || u.deletedAt) throw new Error("ACCOUNT_DELETED");
}

function canManageUsers(ctx: RequestContext) {
  return ctx.user?.roleName === RoleName.ADMIN || ctx.user?.roleName === RoleName.MANAGER;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isUtcMidnight(d: Date) {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday start
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function defaultReportRange(range?: any) {
  const now = new Date();
  const to = range?.to ? new Date(range.to) : now;
  const from = range?.from ? new Date(range.from) : startOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  if (!Number.isFinite(from.valueOf()) || !Number.isFinite(to.valueOf())) {
    return { from: startOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), to: now };
  }
  return { from, to };
}

async function getCustomerForUserOrThrow(userId: string) {
  const customer = await prisma.customer.findFirst({ where: { userId } });
  if (!customer) throw new Error("CUSTOMER_PROFILE_NOT_FOUND");
  return customer;
}

const BRANDING_LOGO_KEY = "BRANDING_LOGO_URL";

let ensureSystemSettingReady: Promise<void> | null = null;
async function ensureSystemSettingTable(): Promise<void> {
  ensureSystemSettingReady ??= (async () => {
    // Best-effort: keep server running even if migrations weren't applied yet.
    // Uses IF NOT EXISTS so it's safe on already-migrated databases.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemSetting" (
        "id" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "value" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");
    `);
  })();
  await ensureSystemSettingReady;
}

let ensureOrderTransferReady: Promise<void> | null = null;
async function ensureOrderTransferSchema(): Promise<void> {
  ensureOrderTransferReady ??= (async () => {
    // Best-effort: allow new transfer columns even if migrations couldn't run.
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "transferredAt" TIMESTAMP(3);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "transferredByUserId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "transferredFromServiceCentreId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "transferredToServiceCentreId" TEXT;`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_transferredAt_idx" ON "Order"("transferredAt");`);
  })();
  await ensureOrderTransferReady;
}

const transferMetaCache = new Map<string, Promise<{ transferredByUserId: string | null; transferredFromServiceCentreId: string | null; transferredToServiceCentreId: string | null }>>();
async function getTransferMeta(orderId: string) {
  const id = String(orderId ?? "").trim();
  if (!id) return { transferredByUserId: null, transferredFromServiceCentreId: null, transferredToServiceCentreId: null };
  const cached = transferMetaCache.get(id);
  if (cached) return cached;
  const p = (async () => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ transferredByUserId: string | null; transferredFromServiceCentreId: string | null; transferredToServiceCentreId: string | null }>
    >(
      `SELECT "transferredByUserId", "transferredFromServiceCentreId", "transferredToServiceCentreId" FROM "Order" WHERE "id" = $1`,
      id
    );
    return rows?.[0] ?? { transferredByUserId: null, transferredFromServiceCentreId: null, transferredToServiceCentreId: null };
  })();
  transferMetaCache.set(id, p);
  return p;
}

async function getSystemSetting(key: string): Promise<string | null> {
  await ensureSystemSettingTable();
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const v = row?.value ?? null;
  if (!v) return null;
  const trimmed = String(v).trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function setSystemSetting(key: string, value: string | null): Promise<void> {
  await ensureSystemSettingTable();
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}

async function assertReportsAccess(ctx: RequestContext) {
  assertAuthenticated(ctx);
  const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
  if (!isAdmin(ctx) && !isManager(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
  if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "VIEW_REPORTS" });
  return delegatedCentreId;
}

async function lowStockItems(args: { serviceCentreId?: string | null; limit?: number }) {
  const limit = Math.min(100, Math.max(1, args.limit ?? 20));
  if (args.serviceCentreId) {
    const items = await prisma.stockItem.findMany({
      where: { serviceCentreId: args.serviceCentreId, isActive: true },
      include: { serviceCentre: true },
      orderBy: { name: "asc" }
    });
    const sums = await prisma.stockMovement.groupBy({
      by: ["stockItemId"],
      where: { serviceCentreId: args.serviceCentreId },
      _sum: { quantity: true }
    });
    const bal = new Map<string, number>();
    for (const s of sums) bal.set(s.stockItemId, s._sum.quantity ?? 0);
    return items
      .map((i) => {
        const balance = bal.get(i.id) ?? 0;
        return { ...i, inTotal: 0, outTotal: 0, total: 0, balance };
      })
      .filter((i) => i.balance <= i.lowStockThreshold)
      .slice(0, limit);
  }

  // global: fetch active items and compute balances in one pass (best-effort for MVP scale)
  const items = await prisma.stockItem.findMany({
    where: { isActive: true },
    include: { serviceCentre: true },
    orderBy: { updatedAt: "desc" },
    take: 500
  });
  const sums = await prisma.stockMovement.groupBy({
    by: ["stockItemId"],
    _sum: { quantity: true }
  });
  const bal = new Map<string, number>();
  for (const s of sums) bal.set(s.stockItemId, s._sum.quantity ?? 0);
  return items
    .map((i) => {
      const balance = bal.get(i.id) ?? 0;
      return { ...i, inTotal: 0, outTotal: 0, total: 0, balance };
    })
    .filter((i) => i.balance <= i.lowStockThreshold)
    .slice(0, limit);
}

async function stockItemComputed(args: { serviceCentreId: string; stockItemId: string }) {
  const grouped = await prisma.stockMovement.groupBy({
    by: ["type"],
    where: { serviceCentreId: args.serviceCentreId, stockItemId: args.stockItemId },
    _sum: { quantity: true }
  });
  let inTotal = 0;
  let outTotal = 0;
  let balance = 0;
  for (const g of grouped) {
    const q = g._sum.quantity ?? 0;
    balance += q;
    if (g.type === StockMovementType.IN) inTotal += q;
    if (g.type === StockMovementType.OUT) outTotal += Math.abs(q);
  }
  return { inTotal, outTotal, total: inTotal + outTotal, balance };
}

export const resolvers = {
  DateTime: DateTimeScalar,
  Decimal: DecimalScalar,

  Query: {
    health: () => "ok",
    appBranding: async () => {
      const logoUrl = await getSystemSetting(BRANDING_LOGO_KEY);
      return { logoUrl };
    },
    me: async (_: unknown, __: unknown, ctx: RequestContext) => {
      if (!ctx.user) return null;
      const u = await prisma.user.findUnique({
        where: { id: ctx.user.userId },
        include: { role: true, serviceCentre: true }
      });
      if (!u) return null;
      assertUserNotDeleted(u);
      return u;
    },
    myDelegatedPermissions: async (_: unknown, __: unknown, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      if (ctx.user?.roleName !== RoleName.STAFF) return [];
      if (!ctx.user.serviceCentreId) return [];
      return delegatedPermissionCodes({ userId: ctx.user.userId, serviceCentreId: ctx.user.serviceCentreId });
    },

    customers: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF, RoleName.CALL_CENTRE_AGENT]);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const where: any = {};
      if (args.search) {
        where.OR = [
          { fullName: { contains: args.search, mode: "insensitive" } },
          { phone: { contains: args.search } }
        ];
      }
      const [total, nodes] = await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.findMany({ where, skip, take, orderBy: { createdAt: "desc" } })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    customer: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF, RoleName.CALL_CENTRE_AGENT]);
      return prisma.customer.findUnique({ where: { id: args.id } });
    },

    serviceCentres: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF, RoleName.CUSTOMER]);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const where: any = {};
      if (args.search) {
        where.OR = [
          { centreName: { contains: args.search, mode: "insensitive" } },
          { locationName: { contains: args.search, mode: "insensitive" } },
          { phone: { contains: args.search } }
        ];
      }
      if (args.status) where.status = args.status;
      if (ctx.user?.roleName === RoleName.STAFF) {
        where.id = mustHaveCentre(ctx);
      }
      const [total, nodes] = await Promise.all([
        prisma.serviceCentre.count({ where }),
        prisma.serviceCentre.findMany({ where, skip, take, orderBy: { createdAt: "desc" } })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    serviceCentre: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF, RoleName.CUSTOMER]);
      if (ctx.user?.roleName === RoleName.MANAGER || ctx.user?.roleName === RoleName.STAFF) {
        const centreId = mustHaveCentre(ctx);
        if (args.id !== centreId) throw new Error("FORBIDDEN");
      }
      return prisma.serviceCentre.findUnique({ where: { id: args.id } });
    },

    services: async (_: unknown, __: unknown, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      return prisma.service.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    },

    products: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF, RoleName.CUSTOMER, RoleName.CALL_CENTRE_AGENT]);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const where: any = {};
      if (args.search) where.name = { contains: args.search, mode: "insensitive" };
      if (args.onlyActive !== false) where.isActive = true;
      const [total, nodes] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({ where, skip, take, orderBy: { name: "asc" } })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    product: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF, RoleName.CUSTOMER, RoleName.CALL_CENTRE_AGENT]);
      return prisma.product.findUnique({ where: { id: args.id } });
    },

    myCustomerProfile: async (_: unknown, __: unknown, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      return prisma.customer.findFirst({ where: { userId: ctx.user!.userId } });
    },

    myOrders: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      await ensureOrderTransferSchema();
      const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const where: any = { customerId: customer.id };
      if (args.status) where.status = args.status;
      const [total, nodes] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: orderInclude
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    myFeedback: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      await ensureOrderTransferSchema();
      const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const where: any = { customerId: customer.id };
      const [total, nodes] = await Promise.all([
        prisma.feedback.count({ where }),
        prisma.feedback.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            customer: true,
            order: { include: orderInclude }
          }
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    orders: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      await ensureOrderTransferSchema();
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const centreId = enforceCentreScope(ctx, args.serviceCentreId ?? null);
      const where: any = {};
      if (args.status) where.status = args.status;
      if (centreId) where.serviceCentreId = centreId;
      const [total, nodes] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: orderInclude
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    sales: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const centreId = enforceCentreScope(ctx, args.serviceCentreId ?? null);

      const where: any = {};
      if (centreId) where.serviceCentreId = centreId;
      if (args.customerId) where.customerId = args.customerId;
      if (args.from || args.to) {
        where.happenedAt = {};
        if (args.from) where.happenedAt.gte = args.from;
        if (args.to) where.happenedAt.lte = args.to;
      }

      const [total, nodes] = await Promise.all([
        prisma.sale.count({ where }),
        prisma.sale.findMany({
          where,
          skip,
          take,
          orderBy: { happenedAt: "desc" },
          include: { customer: true, serviceCentre: true, service: true, staffUser: { include: { role: true, serviceCentre: true } } }
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    salesTotals: async (_: unknown, args: { serviceCentreId?: string | null }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const centreId = enforceCentreScope(ctx, args.serviceCentreId ?? null);
      const now = new Date();
      const [day, week, month] = await Promise.all([
        prisma.sale.aggregate({ where: { ...(centreId ? { serviceCentreId: centreId } : {}), happenedAt: { gte: startOfDay(now) } }, _sum: { amount: true } }),
        prisma.sale.aggregate({ where: { ...(centreId ? { serviceCentreId: centreId } : {}), happenedAt: { gte: startOfWeek(now) } }, _sum: { amount: true } }),
        prisma.sale.aggregate({ where: { ...(centreId ? { serviceCentreId: centreId } : {}), happenedAt: { gte: startOfMonth(now) } }, _sum: { amount: true } })
      ]);
      return {
        day: String(day._sum.amount ?? 0),
        week: String(week._sum.amount ?? 0),
        month: String(month._sum.amount ?? 0)
      };
    },

    salesChart: async (_: unknown, args: { serviceCentreId?: string | null; rangeDays?: number | null }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const centreId = enforceCentreScope(ctx, args.serviceCentreId ?? null);
      const rangeDays = Math.min(365, Math.max(1, args.rangeDays ?? 30));
      const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
      const rows = await prisma.sale.findMany({
        where: { ...(centreId ? { serviceCentreId: centreId } : {}), happenedAt: { gte: from } },
        select: { happenedAt: true, amount: true }
      });
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const key = r.happenedAt.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + Number(r.amount));
      }
      const points = [...byDay.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, amount]) => ({ date, amount: String(amount) }));
      return { points };
    },

    stockItems: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const centreId = enforceCentreScope(ctx, args.serviceCentreId ?? null);
      if (!centreId) throw new Error("SERVICE_CENTRE_REQUIRED");

      const where: any = { serviceCentreId: centreId };
      if (args.search) where.name = { contains: args.search, mode: "insensitive" };

      const [total, nodes] = await Promise.all([
        prisma.stockItem.count({ where }),
        prisma.stockItem.findMany({ where, skip, take, orderBy: { name: "asc" }, include: { serviceCentre: true } })
      ]);

      const nodeIds = nodes.map((n) => n.id);
      const grouped =
        nodeIds.length === 0
          ? []
          : await prisma.stockMovement.groupBy({
              by: ["stockItemId", "type"],
              where: { serviceCentreId: centreId, stockItemId: { in: nodeIds } },
              _sum: { quantity: true }
            });

      const totalsByItem = new Map<string, { inTotal: number; outTotal: number; balance: number }>();
      for (const g of grouped) {
        const itemId = g.stockItemId;
        const current = totalsByItem.get(itemId) ?? { inTotal: 0, outTotal: 0, balance: 0 };
        const sumQty = g._sum.quantity ?? 0;
        current.balance += sumQty;
        if (g.type === StockMovementType.IN) current.inTotal += sumQty;
        if (g.type === StockMovementType.OUT) current.outTotal += Math.abs(sumQty);
        totalsByItem.set(itemId, current);
      }

      const nodesWithComputed = nodes.map((n) => {
        const t = totalsByItem.get(n.id) ?? { inTotal: 0, outTotal: 0, balance: 0 };
        return { ...n, inTotal: t.inTotal, outTotal: t.outTotal, total: t.inTotal + t.outTotal, balance: t.balance };
      });
      return { nodes: nodesWithComputed, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    stockMovements: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const centreId = enforceCentreScope(ctx, args.serviceCentreId ?? null);
      if (!centreId) throw new Error("SERVICE_CENTRE_REQUIRED");

      const where: any = { serviceCentreId: centreId };
      if (args.stockItemId) where.stockItemId = args.stockItemId;
      if (args.from || args.to) {
        where.happenedAt = {};
        if (args.from) where.happenedAt.gte = args.from;
        if (args.to) where.happenedAt.lte = args.to;
      }

      const [total, nodes] = await Promise.all([
        prisma.stockMovement.count({ where }),
        prisma.stockMovement.findMany({
          where,
          skip,
          take,
          orderBy: { happenedAt: "desc" },
          include: { serviceCentre: true, stockItem: { include: { serviceCentre: true } }, createdByUser: { include: { role: true, serviceCentre: true } } }
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    dashboard: async (_: unknown, args: { serviceCentreId?: string | null }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const centreId = enforceCentreScope(ctx, args.serviceCentreId ?? null);
      const from = startOfDay(new Date());

      const [totalCustomers, totalServiceCentres, todaySalesAgg, recentSales, lowStock] = await Promise.all([
        prisma.customer.count(),
        prisma.serviceCentre.count(),
        prisma.sale.aggregate({
          where: { ...(centreId ? { serviceCentreId: centreId } : {}), happenedAt: { gte: from } },
          _sum: { cupsSold: true, takeawayCupsUsed: true, amount: true }
        }),
        prisma.sale.findMany({
          where: { ...(centreId ? { serviceCentreId: centreId } : {}) },
          take: 10,
          orderBy: { happenedAt: "desc" },
          include: { customer: true, serviceCentre: true, service: true, staffUser: { include: { role: true, serviceCentre: true } } }
        }),
        lowStockItems({ serviceCentreId: centreId, limit: 10 })
      ]);

      return {
        kpis: {
          totalCustomers,
          totalServiceCentres,
          cupsSoldToday: todaySalesAgg._sum.cupsSold ?? 0,
          takeawayCupsToday: todaySalesAgg._sum.takeawayCupsUsed ?? 0,
          salesToday: String(todaySalesAgg._sum.amount ?? 0),
          lowStockItems: lowStock.length
        },
        recentSales,
        lowStockItems: lowStock
      };
    },

    users: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      if (!canManageUsers(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
      if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "MANAGE_USERS" });
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);

      const where: any = {};
      const requestedCentreId = args.serviceCentreId ?? null;
      const centreId = isManager(ctx) ? enforceManagerCentre(ctx) : delegatedCentreId ?? requestedCentreId;
      if (isManager(ctx)) where.serviceCentreId = centreId;
      else if (delegatedCentreId) where.serviceCentreId = centreId;
      else if (centreId) where.serviceCentreId = centreId;

      if (args.role) where.role = { name: args.role };
      if (args.status) where.status = args.status;
      else where.status = { not: UserStatus.DELETED };

      if (args.search) {
        where.OR = [
          { fullName: { contains: args.search, mode: "insensitive" } },
          { email: { contains: args.search, mode: "insensitive" } },
          { phone: { contains: args.search } },
          { username: { contains: args.search, mode: "insensitive" } }
        ];
      }

      if (isManager(ctx) || delegatedCentreId) {
        where.role = { name: { in: [RoleName.MANAGER, RoleName.STAFF] } };
      }

      const [total, nodes] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { role: true, serviceCentre: true } })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    user: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      if (!canManageUsers(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
      if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "MANAGE_USERS" });
      const u = await prisma.user.findUnique({ where: { id: args.id }, include: { role: true, serviceCentre: true } });
      if (!u) return null;
      if (isManager(ctx) || delegatedCentreId) {
        const centreId = delegatedCentreId ?? enforceManagerCentre(ctx);
        if (u.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
        if (!([RoleName.MANAGER, RoleName.STAFF] as RoleName[]).includes(u.role.name)) throw new Error("FORBIDDEN");
      }
      return u;
    },

    notifications: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const where: any = { receiverId: ctx.user!.userId };
      if (typeof args.isRead === "boolean") where.isRead = args.isRead;
      else if (args.onlyUnread) where.isRead = false;
      const [total, nodes] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: { sender: { include: { role: true, serviceCentre: true } }, receiver: { include: { role: true, serviceCentre: true } }, serviceCentre: true }
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    unreadNotificationCount: async (_: unknown, __: unknown, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      return prisma.notification.count({ where: { receiverId: ctx.user!.userId, isRead: false } });
    },

    directMessages: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const withUserId = String(args.withUserId ?? "").trim();
      if (!withUserId) throw new Error("INVALID_INPUT");
      const me = ctx.user!.userId;

      const where: any = {
        OR: [
          { senderId: withUserId, receiverId: me },
          { senderId: me, receiverId: withUserId }
        ]
      };

      const [total, nodes] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            sender: { include: { role: true, serviceCentre: true } },
            receiver: { include: { role: true, serviceCentre: true } },
            serviceCentre: true
          }
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    duties: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      if (!isAdmin(ctx) && !isManager(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
      if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "ASSIGN_DUTIES" });
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);

      let centreId: string | null = args.serviceCentreId ?? null;
      if (isManager(ctx)) centreId = enforceManagerCentre(ctx);
      if (delegatedCentreId) centreId = delegatedCentreId;
      if (!centreId) throw new Error("SERVICE_CENTRE_REQUIRED");

      const where: any = { serviceCentreId: centreId };
      if (args.status) where.status = args.status;

      const [total, nodes] = await Promise.all([
        prisma.duty.count({ where }),
        prisma.duty.findMany({
          where,
          skip,
          take,
          orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
          include: {
            assignedToUser: { include: { role: true, serviceCentre: true } },
            assignedByUser: { include: { role: true, serviceCentre: true } },
            serviceCentre: true,
            comments: { include: { user: { include: { role: true, serviceCentre: true } } }, orderBy: { createdAt: "asc" } }
          }
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    myDuties: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const where: any = { assignedToUserId: ctx.user!.userId };
      if (args.status) where.status = args.status;
      const [total, nodes] = await Promise.all([
        prisma.duty.count({ where }),
        prisma.duty.findMany({
          where,
          skip,
          take,
          orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
          include: {
            assignedToUser: { include: { role: true, serviceCentre: true } },
            assignedByUser: { include: { role: true, serviceCentre: true } },
            serviceCentre: true,
            comments: { include: { user: { include: { role: true, serviceCentre: true } } }, orderBy: { createdAt: "asc" } }
          }
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    userDuties: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      if (!isAdmin(ctx) && !isManager(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
      if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "ASSIGN_DUTIES" });

      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const target = await prisma.user.findUnique({ where: { id: args.userId }, select: { id: true, serviceCentreId: true } });
      if (!target) throw new Error("NOT_FOUND");

      if (isManager(ctx) || delegatedCentreId) {
        const centreId = delegatedCentreId ?? enforceManagerCentre(ctx);
        if (target.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      }

      const where: any = { assignedToUserId: args.userId };
      if (args.status) where.status = args.status;

      const [total, nodes] = await Promise.all([
        prisma.duty.count({ where }),
        prisma.duty.findMany({
          where,
          skip,
          take,
          orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
          include: {
            assignedToUser: { include: { role: true, serviceCentre: true } },
            assignedByUser: { include: { role: true, serviceCentre: true } },
            serviceCentre: true,
            comments: { include: { user: { include: { role: true, serviceCentre: true } } }, orderBy: { createdAt: "asc" } }
          }
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    handovers: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const where: any = {};
      if (args.status) where.status = args.status;

      if (isAdmin(ctx)) {
        if (args.serviceCentreId) where.serviceCentreId = args.serviceCentreId;
      } else if (isManager(ctx)) {
        where.serviceCentreId = enforceManagerCentre(ctx);
      } else if (ctx.user?.roleName === RoleName.STAFF) {
        where.assignedStaffId = ctx.user.userId;
      } else {
        throw new Error("FORBIDDEN");
      }

      const [total, nodes] = await Promise.all([
        prisma.handover.count({ where }),
        prisma.handover.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: {
            manager: { include: { role: true, serviceCentre: true } },
            assignedStaff: { include: { role: true, serviceCentre: true } },
            serviceCentre: true,
            permissions: true
          }
        })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    activityLogs: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      if (!isAdmin(ctx) && !isManager(ctx)) throw new Error("FORBIDDEN");
      const { page, pageSize, skip, take } = normalizePagination(args.pagination);
      const where: any = {};
      if (args.module) where.module = args.module;
      if (args.userId) where.userId = args.userId;

      if (isManager(ctx)) {
        const centreId = enforceManagerCentre(ctx);
        where.OR = [{ user: { serviceCentreId: centreId } }, { userId: null }];
      }

      const [total, nodes] = await Promise.all([
        prisma.activityLog.count({ where }),
        prisma.activityLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { user: { include: { role: true, serviceCentre: true } } } })
      ]);
      return { nodes, pageInfo: pageInfo({ page, pageSize, total }) };
    },

    userReport: async (_: unknown, args: any, ctx: RequestContext) => {
      const delegatedCentreId = await assertReportsAccess(ctx);

      let centreId: string | null = args.serviceCentreId ?? null;
      if (isManager(ctx)) centreId = enforceManagerCentre(ctx);
      if (delegatedCentreId) centreId = delegatedCentreId;
      const whereCentre = centreId ? { serviceCentreId: centreId } : {};

      const [totalUsers, activeUsers, suspendedUsers, deletedUsers, groupedByRole, centres] = await Promise.all([
        prisma.user.count({ where: { ...whereCentre, status: { not: UserStatus.DELETED } } }),
        prisma.user.count({ where: { ...whereCentre, status: UserStatus.ACTIVE } }),
        prisma.user.count({ where: { ...whereCentre, status: UserStatus.SUSPENDED } }),
        prisma.user.count({ where: { ...whereCentre, status: UserStatus.DELETED } }),
        prisma.user.groupBy({ by: ["roleId"], where: { ...whereCentre, status: { not: UserStatus.DELETED } }, _count: { _all: true } }),
        prisma.serviceCentre.findMany({ orderBy: { centreName: "asc" } })
      ]);

      const roles = await prisma.role.findMany();
      const roleById = new Map(roles.map((r) => [r.id, r.name]));

      const usersByRole = groupedByRole
        .map((r) => ({ role: roleById.get(r.roleId) ?? RoleName.STAFF, total: r._count._all }))
        .sort((a, b) => (a.role < b.role ? -1 : 1));

      const usersByServiceCentre = centreId
        ? [{ serviceCentre: await prisma.serviceCentre.findUniqueOrThrow({ where: { id: centreId } }), total: totalUsers }]
        : await Promise.all(
            centres.map(async (c) => ({
              serviceCentre: c,
              total: await prisma.user.count({ where: { serviceCentreId: c.id, status: { not: UserStatus.DELETED } } })
            }))
          );

      return { totalUsers, activeUsers, suspendedUsers, deletedUsers, usersByRole, usersByServiceCentre };
    },

    orderStatusReport: async (_: unknown, args: any, ctx: RequestContext) => {
      const delegatedCentreId = await assertReportsAccess(ctx);
      let centreId: string | null = args.serviceCentreId ?? null;
      if (isManager(ctx)) centreId = enforceManagerCentre(ctx);
      if (delegatedCentreId) centreId = delegatedCentreId;
      const { from, to } = defaultReportRange(args.range);

      const grouped = await prisma.order.groupBy({
        by: ["status"],
        where: { ...(centreId ? { serviceCentreId: centreId } : {}), createdAt: { gte: from, lte: to } },
        _count: { _all: true }
      });

      const byStatus = grouped
        .map((g) => ({ status: g.status as any, total: g._count._all }))
        .sort((a, b) => (a.status < b.status ? -1 : 1));

      const total = byStatus.reduce((acc, p) => acc + p.total, 0);
      return { total, byStatus };
    },

    stockInOutReport: async (_: unknown, args: any, ctx: RequestContext) => {
      const delegatedCentreId = await assertReportsAccess(ctx);
      let centreId: string | null = args.serviceCentreId ?? null;
      if (isManager(ctx)) centreId = enforceManagerCentre(ctx);
      if (delegatedCentreId) centreId = delegatedCentreId;
      const { from, to } = defaultReportRange(args.range);

      const grouped = await prisma.stockMovement.groupBy({
        by: ["type"],
        where: { ...(centreId ? { serviceCentreId: centreId } : {}), happenedAt: { gte: from, lte: to } },
        _sum: { quantity: true }
      });
      const inTotal = grouped.find((g) => g.type === StockMovementType.IN)?._sum.quantity ?? 0;
      const outSigned = grouped.find((g) => g.type === StockMovementType.OUT)?._sum.quantity ?? 0;
      const outTotal = Math.abs(outSigned);
      return { inTotal, outTotal, net: inTotal - outTotal };
    },

    serviceCentreStocksReport: async (_: unknown, _args: unknown, ctx: RequestContext) => {
      const delegatedCentreId = await assertReportsAccess(ctx);
      let centreIds: string[] = [];
      if (isAdmin(ctx)) {
        const centres = await prisma.serviceCentre.findMany({ orderBy: { centreName: "asc" }, select: { id: true } });
        centreIds = centres.map((c) => c.id);
      } else {
        const centreId = delegatedCentreId ?? enforceManagerCentre(ctx);
        centreIds = [centreId];
      }
      if (!centreIds.length) return [];

      const [centres, items, sums] = await Promise.all([
        prisma.serviceCentre.findMany({ where: { id: { in: centreIds } }, orderBy: { centreName: "asc" } }),
        prisma.stockItem.findMany({ where: { serviceCentreId: { in: centreIds }, isActive: true }, select: { id: true, serviceCentreId: true, lowStockThreshold: true } }),
        prisma.stockMovement.groupBy({
          by: ["serviceCentreId", "stockItemId"],
          where: { serviceCentreId: { in: centreIds } },
          _sum: { quantity: true }
        })
      ]);

      const balByItem = new Map<string, number>();
      for (const s of sums) balByItem.set(`${s.serviceCentreId}:${s.stockItemId}`, s._sum.quantity ?? 0);

      const byCentre = new Map<string, { stockItems: number; lowStockItems: number; totalBalance: number }>();
      for (const c of centreIds) byCentre.set(c, { stockItems: 0, lowStockItems: 0, totalBalance: 0 });

      for (const it of items) {
        const key = `${it.serviceCentreId}:${it.id}`;
        const bal = balByItem.get(key) ?? 0;
        const agg = byCentre.get(it.serviceCentreId);
        if (!agg) continue;
        agg.stockItems += 1;
        agg.totalBalance += bal;
        if (bal <= it.lowStockThreshold) agg.lowStockItems += 1;
      }

      return centres.map((c) => ({ serviceCentre: c, ...(byCentre.get(c.id) ?? { stockItems: 0, lowStockItems: 0, totalBalance: 0 }) }));
    },

    stockBalances: async (_: unknown, args: { serviceCentreId: string }, ctx: RequestContext) => {
      const delegatedCentreId = await assertReportsAccess(ctx);
      let centreId: string | null = args.serviceCentreId ?? null;
      if (!centreId) throw new Error("SERVICE_CENTRE_REQUIRED");
      if (isManager(ctx)) centreId = enforceManagerCentre(ctx);
      if (delegatedCentreId) centreId = delegatedCentreId;

      if (!isAdmin(ctx)) {
        const myCentre = delegatedCentreId ?? enforceManagerCentre(ctx);
        if (centreId !== myCentre) throw new Error("FORBIDDEN");
      }

      const [items, sums] = await Promise.all([
        prisma.stockItem.findMany({ where: { serviceCentreId: centreId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, lowStockThreshold: true } }),
        prisma.stockMovement.groupBy({ by: ["stockItemId"], where: { serviceCentreId: centreId }, _sum: { quantity: true } })
      ]);
      const bal = new Map<string, number>();
      for (const s of sums) bal.set(s.stockItemId, s._sum.quantity ?? 0);
      return items.map((i) => ({ ...i, balance: bal.get(i.id) ?? 0 }));
    },

    topCustomers: async (_: unknown, args: any, ctx: RequestContext) => {
      const delegatedCentreId = await assertReportsAccess(ctx);
      let centreId: string | null = args.serviceCentreId ?? null;
      if (isManager(ctx)) centreId = enforceManagerCentre(ctx);
      if (delegatedCentreId) centreId = delegatedCentreId;
      const { from, to } = defaultReportRange(args.range);
      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 10) || 10));

      const grouped = await prisma.sale.groupBy({
        by: ["customerId"],
        where: {
          ...(centreId ? { serviceCentreId: centreId } : {}),
          customerId: { not: null },
          happenedAt: { gte: from, lte: to }
        },
        _count: { customerId: true }
      });

      const sorted = grouped
        .map((g) => ({ customerId: g.customerId as string, visits: g._count.customerId ?? 0 }))
        .filter((g) => Boolean(g.customerId))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, limit);

      const ids = sorted.map((g) => g.customerId);
      if (!ids.length) return [];
      const customers = await prisma.customer.findMany({ where: { id: { in: ids } } });
      const byId = new Map(customers.map((c) => [c.id, c]));
      return sorted.map((g) => ({ customer: byId.get(g.customerId), visits: g.visits })).filter((x) => Boolean(x.customer));
    }
  },

  Mutation: {
    login: async (_: unknown, args: { input: { email: string; password: string } }, ctx: RequestContext) => {
      const email = String(args.input.email ?? "").trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email }, include: { role: true, serviceCentre: true } });
      if (!user) throw new Error("INVALID_CREDENTIALS");
      assertUserNotDeleted(user);
      if (user.status !== UserStatus.ACTIVE) throw new Error("INVALID_CREDENTIALS");
      const ok = await verifyPassword(args.input.password, user.passwordHash);
      if (!ok) throw new Error("INVALID_CREDENTIALS");
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      const jwtPayload: JwtUser = { sub: user.id, role: user.role.name, serviceCentreId: user.serviceCentreId };
      const tokens = {
        accessToken: signAccessToken(jwtPayload, ctx.env.JWT_ACCESS_SECRET, ctx.env.JWT_ACCESS_TTL),
        refreshToken: signRefreshToken(jwtPayload, ctx.env.JWT_REFRESH_SECRET, ctx.env.JWT_REFRESH_TTL)
      };
      return { tokens, user };
    },

    requestCustomerPasswordReset: async (_: unknown, args: { email: string }, _ctx: RequestContext) => {
      const email = String(args.email ?? "").trim().toLowerCase();
      if (!email || !email.includes("@")) return false;
      const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
      if (!user) return false;
      if (user.status !== UserStatus.ACTIVE) return false;
      if (user.role?.name !== RoleName.CUSTOMER) return false;
      return true;
    },

    resetCustomerPassword: async (_: unknown, args: { email: string; newPassword: string }, _ctx: RequestContext) => {
      const email = String(args.email ?? "").trim().toLowerCase();
      const newPassword = String(args.newPassword ?? "");
      if (!email || !email.includes("@")) return false;
      if (newPassword.length < 6) throw new Error("INVALID_PASSWORD");
      const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
      if (!user) return false;
      if (user.status !== UserStatus.ACTIVE) return false;
      if (user.role?.name !== RoleName.CUSTOMER) return false;
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
      return true;
    },

    resetUserPassword: async (_: unknown, args: { userId: string; newPassword: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER]);
      const userId = String(args.userId ?? "").trim();
      const newPassword = String(args.newPassword ?? "");
      if (!userId) throw new Error("INVALID_INPUT");
      if (newPassword.length < 6) throw new Error("INVALID_PASSWORD");

      const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, serviceCentre: true } });
      if (!target) throw new Error("USER_NOT_FOUND");
      assertUserNotDeleted(target);

      const actorRole = ctx.user?.roleName;
      if (actorRole === RoleName.MANAGER) {
        const actor = await prisma.user.findUnique({ where: { id: ctx.user!.userId }, include: { role: true } });
        if (!actor) throw new Error("UNAUTHORIZED");
        const actorCentreId = actor.serviceCentreId ?? null;
        if (!actorCentreId) throw new Error("FORBIDDEN");
        if ((target.serviceCentreId ?? null) !== actorCentreId) throw new Error("FORBIDDEN");
        if (target.role?.name !== RoleName.STAFF) throw new Error("FORBIDDEN");
      }

      await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(newPassword) } });
      await logActivity(ctx, { module: "USERS", action: "PASSWORD_RESET", description: `Password reset for user ${target.id}` });
      return true;
    },

    refresh: async (_: unknown, args: { refreshToken: string }, ctx: RequestContext) => {
      const decoded = verifyToken<JwtUser>(args.refreshToken, ctx.env.JWT_REFRESH_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.sub }, include: { role: true } });
      if (!user) throw new Error("INVALID_TOKEN");
      assertUserNotDeleted(user);
      if (user.status !== UserStatus.ACTIVE) throw new Error("INVALID_TOKEN");
      const jwtPayload: JwtUser = { sub: user.id, role: user.role.name, serviceCentreId: user.serviceCentreId };
      return {
        accessToken: signAccessToken(jwtPayload, ctx.env.JWT_ACCESS_SECRET, ctx.env.JWT_ACCESS_TTL),
        refreshToken: signRefreshToken(jwtPayload, ctx.env.JWT_REFRESH_SECRET, ctx.env.JWT_REFRESH_TTL)
      };
    },

    registerCustomer: async (_: unknown, args: { input: { email: string; username: string; phone: string; password: string } }, ctx: RequestContext) => {
      const email = String(args.input.email ?? "").trim().toLowerCase();
      const username = String(args.input.username ?? "").trim();
      const phone = String(args.input.phone ?? "").trim();
      const password = String(args.input.password ?? "");
      if (!email || !username || !phone || password.length < 6) throw new Error("INVALID_INPUT");

      const role = await prisma.role.findUnique({ where: { name: RoleName.CUSTOMER } });
      if (!role) throw new Error("CUSTOMER_ROLE_MISSING");

      const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }, { phone }] } });
      if (existing) throw new Error("ACCOUNT_ALREADY_EXISTS");

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          username,
          phone,
          fullName: username,
          passwordHash,
          roleId: role.id
        },
        include: { role: true, serviceCentre: true }
      });

      await prisma.customer.create({
        data: { fullName: username, phone, email, userId: user.id }
      });

      const jwtPayload: JwtUser = { sub: user.id, role: user.role.name, serviceCentreId: null };
      const tokens = {
        accessToken: signAccessToken(jwtPayload, ctx.env.JWT_ACCESS_SECRET, ctx.env.JWT_ACCESS_TTL),
        refreshToken: signRefreshToken(jwtPayload, ctx.env.JWT_REFRESH_SECRET, ctx.env.JWT_REFRESH_TTL)
      };
      return { tokens, user };
    },

    updateMyProfile: async (_: unknown, args: { input: any }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
      const input = args.input ?? {};
      const data: any = {};
      if (input.fullName !== undefined) data.fullName = input.fullName;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.address !== undefined) data.address = input.address;
      if (input.customerType !== undefined) data.customerType = input.customerType;
      if (input.notes !== undefined) data.notes = input.notes;

      const updated = await prisma.customer.update({ where: { id: customer.id }, data });
      await prisma.user.update({
        where: { id: ctx.user!.userId },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.address !== undefined ? { address: input.address } : {})
        }
      });
      return updated;
    },

    updateMyAccount: async (_: unknown, args: { input: any }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const input = args.input ?? {};
      const data: any = {};
      if (input.fullName !== undefined) {
        const v = String(input.fullName ?? "").trim();
        if (!v) throw new Error("INVALID_INPUT");
        data.fullName = v;
      }
      if (input.phone !== undefined) data.phone = input.phone === null ? null : String(input.phone ?? "").trim() || null;
      if (input.address !== undefined) data.address = input.address === null ? null : String(input.address ?? "").trim() || null;
      if (input.profilePhoto !== undefined) data.profilePhoto = input.profilePhoto ? String(input.profilePhoto).trim() : null;
      if (Object.keys(data).length === 0) throw new Error("INVALID_INPUT");
      const updated = await prisma.user.update({
        where: { id: ctx.user!.userId },
        data,
        include: { role: true, serviceCentre: true }
      });
      await logActivity(ctx, { module: "PROFILE", action: "PROFILE_UPDATED", description: `User updated own profile` });
      return updated;
    },

    setAppBranding: async (_: unknown, args: { logoUrl?: string | null }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN]);
      const logoUrl = args.logoUrl === undefined || args.logoUrl === null || String(args.logoUrl).trim().length === 0 ? null : String(args.logoUrl).trim();
      await setSystemSetting(BRANDING_LOGO_KEY, logoUrl);
      return { logoUrl };
    },

    createFeedback: async (_: unknown, args: { input: any }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      await ensureOrderTransferSchema();
      const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
      const input = args.input ?? {};
      const rating = Number(input.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error("INVALID_RATING");
      const comment = input.comment === undefined || input.comment === null ? null : String(input.comment).trim();
      const orderId = input.orderId ? String(input.orderId).trim() : null;

      let order: any = null;
      if (orderId) {
        order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.customerId !== customer.id) throw new Error("FORBIDDEN");
        if (order.status !== OrderStatus.COMPLETED) throw new Error("ORDER_NOT_COMPLETED");
      }

      const created = await prisma.feedback.create({
        data: { customerId: customer.id, orderId: orderId, rating: Math.trunc(rating), comment: comment || null },
        include: { customer: true, order: { include: orderInclude } }
      });

      await logActivity(ctx, { module: "FEEDBACK", action: "FEEDBACK_CREATED", description: orderId ? `Customer left feedback for order ${orderId}` : "Customer left feedback" });
      return created;
    },

    createCustomer: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      return prisma.customer.create({ data: args.input });
    },
    updateCustomer: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      return prisma.customer.update({ where: { id: args.id }, data: args.input });
    },
    deleteCustomer: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN]);
      await prisma.customer.delete({ where: { id: args.id } });
      return true;
    },

    createServiceCentre: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN]);
      return prisma.serviceCentre.create({ data: args.input });
    },
    updateServiceCentre: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN]);
      return prisma.serviceCentre.update({ where: { id: args.id }, data: args.input });
    },
    setServiceCentreStatus: async (_: unknown, args: { id: string; status: any }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN]);
      return prisma.serviceCentre.update({ where: { id: args.id }, data: { status: args.status } });
    },

    createSale: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const centreId = enforceCentreScope(ctx, args.input.serviceCentreId);
      return prisma.sale.create({
        data: {
          serviceCentreId: centreId!,
          customerId: args.input.customerId ?? null,
          serviceId: args.input.serviceId ?? null,
          serviceCustom: args.input.serviceCustom ?? null,
          cupsSold: args.input.cupsSold ?? 0,
          takeawayCupsUsed: args.input.takeawayCupsUsed ?? 0,
          amount: args.input.amount,
          currency: args.input.currency ?? "TZS",
          staffUserId: ctx.user?.userId ?? null,
          happenedAt: args.input.happenedAt ?? new Date()
        },
        include: { customer: true, serviceCentre: true, service: true, staffUser: { include: { role: true, serviceCentre: true } } }
      });
    },

    createStockItem: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER]);
      const centreId = enforceCentreScope(ctx, args.input.serviceCentreId);
      const item = await prisma.stockItem.create({
        data: {
          serviceCentreId: centreId!,
          name: args.input.name,
          unit: args.input.unit ?? "unit",
          lowStockThreshold: args.input.lowStockThreshold ?? 0
        },
        include: { serviceCentre: true }
      });
      return { ...item, inTotal: 0, outTotal: 0, total: 0, balance: 0 };
    },

    updateStockItem: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER]);
      const id = String(args.id ?? "").trim();
      if (!id) throw new Error("INVALID_INPUT");
      const existing = await prisma.stockItem.findUnique({ where: { id }, include: { serviceCentre: true } });
      if (!existing) throw new Error("STOCK_ITEM_NOT_FOUND");
      enforceCentreScope(ctx, existing.serviceCentreId);

      const input = args.input ?? {};
      const data: any = {};
      if (input.name !== undefined) data.name = String(input.name ?? "").trim();
      if (input.unit !== undefined) data.unit = String(input.unit ?? "").trim() || "unit";
      if (input.lowStockThreshold !== undefined) data.lowStockThreshold = input.lowStockThreshold ?? 0;
      if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
      if (data.name !== undefined && !data.name) throw new Error("INVALID_INPUT");

      const updated = await prisma.stockItem.update({ where: { id }, data, include: { serviceCentre: true } });
      await logActivity(ctx, { module: "STOCK", action: "STOCK_ITEM_UPDATED", description: `Updated stock item ${updated.name}` });
      const computed = await stockItemComputed({ serviceCentreId: updated.serviceCentreId, stockItemId: updated.id });
      return { ...updated, ...computed };
    },

    createStockMovement: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const centreId = enforceCentreScope(ctx, args.input.serviceCentreId);

      const stockItemId = String(args.input.stockItemId ?? "").trim();
      if (!stockItemId) throw new Error("STOCK_ITEM_REQUIRED");
      const stockItem = await prisma.stockItem.findFirst({ where: { id: stockItemId, serviceCentreId: centreId! } });
      if (!stockItem) throw new Error("STOCK_ITEM_NOT_FOUND");

      const rawQty = Number(args.input.quantity);
      if (!Number.isFinite(rawQty) || rawQty === 0) throw new Error("INVALID_QUANTITY");
      const movementType = args.input.type as StockMovementType;
      const signedQty =
        movementType === StockMovementType.OUT
          ? -Math.abs(rawQty)
          : movementType === StockMovementType.IN
            ? Math.abs(rawQty)
            : rawQty;

      return prisma.stockMovement.create({
        data: {
          serviceCentreId: centreId!,
          stockItemId,
          type: movementType,
          quantity: signedQty,
          note: args.input.note ?? null,
          happenedAt: args.input.happenedAt ?? new Date(),
          createdByUserId: ctx.user?.userId ?? null
        },
        include: {
          serviceCentre: true,
          stockItem: { include: { serviceCentre: true } },
          createdByUser: { include: { role: true, serviceCentre: true } }
        }
      });
    },

    deleteStockItem: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER]);
      const id = String(args.id ?? "").trim();
      if (!id) throw new Error("INVALID_INPUT");
      const existing = await prisma.stockItem.findUnique({ where: { id }, include: { serviceCentre: true } });
      if (!existing) throw new Error("STOCK_ITEM_NOT_FOUND");
      enforceCentreScope(ctx, existing.serviceCentreId);
      const updated = await prisma.stockItem.update({ where: { id }, data: { isActive: false }, include: { serviceCentre: true } });
      await logActivity(ctx, { module: "STOCK", action: "STOCK_ITEM_DEACTIVATED", description: `Deactivated stock item ${updated.name}` });
      const computed = await stockItemComputed({ serviceCentreId: updated.serviceCentreId, stockItemId: updated.id });
      return { ...updated, ...computed };
    },

    createProduct: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const input = args.input ?? {};
      const name = String(input.name ?? "").trim();
      if (!name) throw new Error("INVALID_INPUT");
      const created = await prisma.product.create({
        data: {
          name,
          description: input.description ?? null,
          price: input.price,
          currency: input.currency ?? "TZS",
          isActive: true,
          imageUrl: input.imageUrl ? String(input.imageUrl).trim() : null
        }
      });
      await logActivity(ctx, { module: "PRODUCTS", action: "PRODUCT_CREATED", description: `Created product ${created.name}` });
      return created;
    },

    updateProduct: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const input = args.input ?? {};
      const data: any = {};
      if (input.name !== undefined) data.name = String(input.name ?? "").trim();
      if (input.description !== undefined) data.description = input.description ?? null;
      if (input.price !== undefined) data.price = input.price;
      if (input.currency !== undefined) data.currency = input.currency ?? "TZS";
      if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
      if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl ? String(input.imageUrl).trim() : null;
      const updated = await prisma.product.update({ where: { id: args.id }, data });
      await logActivity(ctx, { module: "PRODUCTS", action: "PRODUCT_UPDATED", description: `Updated product ${updated.name}` });
      return updated;
    },

    deleteProduct: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      const updated = await prisma.product.update({ where: { id: args.id }, data: { isActive: false } });
      await logActivity(ctx, { module: "PRODUCTS", action: "PRODUCT_DEACTIVATED", description: `Deactivated product ${updated.name}` });
      return updated;
    },

    createOrder: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      await ensureOrderTransferSchema();
      const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
      const productId = String(args.input?.productId ?? "");
      const qty = Math.max(1, Math.min(1000, Number(args.input?.quantity ?? 1) || 1));
      const serviceCentreId = args.input?.serviceCentreId ?? null;
      if (!productId) throw new Error("INVALID_INPUT");
      if (!serviceCentreId) throw new Error("SERVICE_CENTRE_REQUIRED");

      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product || !product.isActive) throw new Error("PRODUCT_NOT_AVAILABLE");

      const unitPrice = new Prisma.Decimal(product.price);
      const lineTotal = unitPrice.mul(qty);

      const order = await prisma.order.create({
        data: {
          customerId: customer.id,
          serviceCentreId,
          status: OrderStatus.PENDING,
          items: {
            create: [{ productId: product.id, quantity: qty, unitPrice, lineTotal }]
          }
        },
        include: orderInclude
      });

      // Notify service centre users about the new order
      const centreUsers = await prisma.user.findMany({
        where: { serviceCentreId, status: UserStatus.ACTIVE, role: { name: { in: [RoleName.MANAGER, RoleName.STAFF] } } },
        select: { id: true }
      });
      if (centreUsers.length) {
        await prisma.notification.createMany({
          data: centreUsers.map((u) => ({
            title: "New order",
            message: `New order ${order.id} from ${order.customer.fullName}`,
            type: NotificationType.TASK,
            senderId: ctx.user!.userId,
            receiverId: u.id,
            serviceCentreId
          }))
        });
      }

      await logActivity(ctx, { module: "ORDERS", action: "ORDER_CREATED", description: `Customer created order ${order.id}` });
      return order;
    },

    staffCompleteOrder: async (_: unknown, args: { orderId: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      await ensureOrderTransferSchema();
      const order = await prisma.order.findUnique({ where: { id: args.orderId } });
      if (!order) throw new Error("NOT_FOUND");
      const centreId = enforceCentreScope(ctx, order.serviceCentreId ?? null);
      if (centreId && order.serviceCentreId && order.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      if (order.status !== OrderStatus.PENDING) throw new Error("INVALID_STATUS");

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.STAFF_COMPLETED, staffCompletedAt: new Date(), staffCompletedByUserId: ctx.user!.userId },
        include: orderInclude
      });

      const customerUserId = (updated.customer as any)?.userId ?? null;
      if (customerUserId) {
        await prisma.notification.create({
          data: {
            title: "Order ready",
            message: `Your order ${updated.id} is ready for confirmation.`,
            type: NotificationType.INFO,
            senderId: ctx.user!.userId,
            receiverId: customerUserId,
            serviceCentreId: updated.serviceCentreId ?? null
          }
        });
      }

      await logActivity(ctx, { module: "ORDERS", action: "ORDER_STAFF_COMPLETED", description: `Staff completed order ${order.id} (awaiting customer)` });
      return updated;
    },

    acknowledgeOrder: async (_: unknown, args: { orderId: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      await ensureOrderTransferSchema();
      const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
      const order = await prisma.order.findUnique({ where: { id: args.orderId } });
      if (!order) throw new Error("NOT_FOUND");
      if (order.customerId !== customer.id) throw new Error("FORBIDDEN");
      if (order.status !== OrderStatus.STAFF_COMPLETED) throw new Error("INVALID_STATUS");

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.COMPLETED, customerAcknowledgedAt: new Date() },
        include: orderInclude
      });

      // System-generated receipt notification
      const customerUserId = (updated.customer as any)?.userId ?? null;
      if (customerUserId) {
        const lines: string[] = [];
        lines.push("KAHAWA MKONONI RECEIPT");
        lines.push(`Order: ${updated.id}`);
        lines.push(`Date: ${new Date(updated.customerAcknowledgedAt ?? updated.updatedAt ?? new Date()).toISOString()}`);
        if (updated.serviceCentre) lines.push(`Service centre: ${(updated.serviceCentre as any).centreName ?? ""}`.trim());
        lines.push("");
        lines.push("Items:");
        const items = (updated.items ?? []) as any[];
        for (const it of items) {
          const name = it.product?.name ?? "Item";
          const qty = it.quantity ?? 1;
          const unit = it.unitPrice?.toString?.() ?? "";
          const total = it.lineTotal?.toString?.() ?? "";
          lines.push(`- ${name} x${qty} @ ${unit} = ${total}`);
        }
        lines.push("");
        const sum = items.reduce((acc: any, it: any) => acc.add(new Prisma.Decimal(it.lineTotal)), new Prisma.Decimal(0));
        const currency = items?.[0]?.product?.currency ?? "TZS";
        lines.push(`TOTAL: ${sum.toString()} ${currency}`);

        await prisma.notification.create({
          data: {
            title: `Receipt: ${updated.id}`,
            message: lines.join("\n"),
            type: NotificationType.SYSTEM,
            senderId: null,
            receiverId: customerUserId,
            serviceCentreId: updated.serviceCentreId ?? null
          }
        });
      }

      // Notify transfer initiator (if any)
      const transferredByUserIdRow = await prisma.$queryRawUnsafe<Array<{ transferredByUserId: string | null }>>(
        `SELECT "transferredByUserId" FROM "Order" WHERE "id" = $1`,
        updated.id
      );
      const transferredByUserId = transferredByUserIdRow?.[0]?.transferredByUserId ?? null;
      if (transferredByUserId) {
        await prisma.notification.create({
          data: {
            title: "Transferred order completed",
            message: `Order ${updated.id} was confirmed completed by the customer.`,
            type: NotificationType.INFO,
            senderId: customerUserId ?? ctx.user!.userId,
            receiverId: transferredByUserId,
            serviceCentreId: updated.serviceCentreId ?? null
          }
        });
      }

      await logActivity(ctx, { module: "ORDERS", action: "ORDER_ACKNOWLEDGED", description: `Customer acknowledged order ${order.id}` });
      return updated;
    },

    rejectOrder: async (_: unknown, args: { orderId: string; reason: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      await ensureOrderTransferSchema();
      const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
      const order = await prisma.order.findUnique({ where: { id: args.orderId }, include: { customer: true } });
      if (!order) throw new Error("NOT_FOUND");
      if (order.customerId !== customer.id) throw new Error("FORBIDDEN");
      if (order.status !== OrderStatus.STAFF_COMPLETED) throw new Error("INVALID_STATUS");

      const reason = String(args.reason ?? "").trim();
      if (!reason) throw new Error("REASON_REQUIRED");

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CUSTOMER_REJECTED, customerRejectedAt: new Date(), customerRejectionReason: reason },
        include: orderInclude
      });

      if (updated.serviceCentreId) {
        const users = await prisma.user.findMany({
          where: { serviceCentreId: updated.serviceCentreId, status: UserStatus.ACTIVE, role: { name: { in: [RoleName.MANAGER, RoleName.STAFF, RoleName.ADMIN] } } },
          select: { id: true }
        });
        if (users.length) {
          await prisma.notification.createMany({
            data: users.map((u) => ({
              title: "Order not completed",
              message: `Customer rejected order ${updated.id}: ${reason}`,
              type: NotificationType.TASK,
              senderId: ctx.user!.userId,
              receiverId: u.id,
              serviceCentreId: updated.serviceCentreId
            }))
          });
        }
      }

      // Notify transfer initiator (if any)
      const transferredByUserIdRow = await prisma.$queryRawUnsafe<Array<{ transferredByUserId: string | null }>>(
        `SELECT "transferredByUserId" FROM "Order" WHERE "id" = $1`,
        updated.id
      );
      const transferredByUserId = transferredByUserIdRow?.[0]?.transferredByUserId ?? null;
      if (transferredByUserId) {
        await prisma.notification.create({
          data: {
            title: "Transferred order rejected",
            message: `Order ${updated.id} was rejected by the customer: ${reason}`,
            type: NotificationType.TASK,
            senderId: ctx.user!.userId,
            receiverId: transferredByUserId,
            serviceCentreId: updated.serviceCentreId ?? null
          }
        });
      }

      await logActivity(ctx, { module: "ORDERS", action: "ORDER_REJECTED", description: `Customer rejected order ${order.id}` });
      return updated;
    },

    staffRespondOrderRejection: async (_: unknown, args: { orderId: string; message: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      await ensureOrderTransferSchema();
      const order = await prisma.order.findUnique({ where: { id: args.orderId }, include: { customer: true } });
      if (!order) throw new Error("NOT_FOUND");
      const centreId = enforceCentreScope(ctx, order.serviceCentreId ?? null);
      if (centreId && order.serviceCentreId && order.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      if (order.status !== OrderStatus.CUSTOMER_REJECTED) throw new Error("INVALID_STATUS");

      const message = String(args.message ?? "").trim();
      if (!message) throw new Error("MESSAGE_REQUIRED");

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.STAFF_COMPLETED,
          staffCompletedAt: new Date(),
          staffCompletedByUserId: ctx.user!.userId,
          staffResponseAt: new Date(),
          staffResponseByUserId: ctx.user!.userId,
          staffResponseMessage: message
        },
        include: orderInclude
      });

      const customerUserId = (updated.customer as any)?.userId ?? null;
      if (customerUserId) {
        await prisma.notification.create({
          data: {
            title: "Order update",
            message: `Staff replied: ${message}`,
            type: NotificationType.INFO,
            senderId: ctx.user!.userId,
            receiverId: customerUserId,
            serviceCentreId: updated.serviceCentreId ?? null
          }
        });
      }

      await logActivity(ctx, { module: "ORDERS", action: "ORDER_STAFF_RESPONDED", description: `Staff responded to rejection for order ${order.id}` });
      return updated;
    },

    cancelMyOrder: async (_: unknown, args: { orderId: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      await ensureOrderTransferSchema();
      const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
      const order = await prisma.order.findUnique({ where: { id: args.orderId } });
      if (!order) throw new Error("NOT_FOUND");
      if (order.customerId !== customer.id) throw new Error("FORBIDDEN");
      if (order.status !== OrderStatus.PENDING) throw new Error("INVALID_STATUS");

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
        include: orderInclude
      });

      if (updated.serviceCentreId) {
        const users = await prisma.user.findMany({
          where: { serviceCentreId: updated.serviceCentreId, status: UserStatus.ACTIVE, role: { name: { in: [RoleName.MANAGER, RoleName.STAFF] } } },
          select: { id: true }
        });
        if (users.length) {
          await prisma.notification.createMany({
            data: users.map((u) => ({
              title: "Order cancelled",
              message: `Customer cancelled order ${updated.id}.`,
              type: NotificationType.INFO,
              senderId: ctx.user!.userId,
              receiverId: u.id,
              serviceCentreId: updated.serviceCentreId
            }))
          });
        }
      }

      await logActivity(ctx, { module: "ORDERS", action: "ORDER_CANCELLED", description: `Customer cancelled order ${order.id}` });
      return updated;
    },

    updateMyOrder: async (_: unknown, args: { orderId: string; input: any }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.CUSTOMER]);
      await ensureOrderTransferSchema();
      const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
      const order = await prisma.order.findUnique({ where: { id: args.orderId }, include: { items: true } });
      if (!order) throw new Error("NOT_FOUND");
      if (order.customerId !== customer.id) throw new Error("FORBIDDEN");
      if (order.status !== OrderStatus.PENDING) throw new Error("INVALID_STATUS");
      const firstItem = order.items?.[0];
      if (!firstItem) throw new Error("INVALID_ORDER");

      const input = args.input ?? {};
      const productId = input.productId ? String(input.productId) : firstItem.productId;
      const quantity = input.quantity === undefined ? firstItem.quantity : Math.max(1, Math.min(1000, Number(input.quantity) || 1));
      const serviceCentreId = input.serviceCentreId === undefined ? order.serviceCentreId : (input.serviceCentreId ? String(input.serviceCentreId) : null);
      if (!serviceCentreId) throw new Error("SERVICE_CENTRE_REQUIRED");

      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product || !product.isActive) throw new Error("PRODUCT_NOT_AVAILABLE");
      const unitPrice = new Prisma.Decimal(product.price);
      const lineTotal = unitPrice.mul(quantity);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: order.id }, data: { serviceCentreId } });
        await tx.orderItem.update({ where: { id: firstItem.id }, data: { productId: product.id, quantity, unitPrice, lineTotal } });
        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: orderInclude
        });
      });

      await logActivity(ctx, { module: "ORDERS", action: "ORDER_UPDATED", description: `Customer updated order ${order.id}` });
      return updated;
    },

    staffMessageOrder: async (_: unknown, args: { orderId: string; message: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER, RoleName.STAFF]);
      await ensureOrderTransferSchema();
      const order = await prisma.order.findUnique({ where: { id: args.orderId }, include: { customer: true } });
      if (!order) throw new Error("NOT_FOUND");
      const centreId = enforceCentreScope(ctx, order.serviceCentreId ?? null);
      if (centreId && order.serviceCentreId && order.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      if (order.status !== OrderStatus.PENDING) throw new Error("INVALID_STATUS");

      const message = String(args.message ?? "").trim();
      if (!message) throw new Error("MESSAGE_REQUIRED");

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { staffMessageAt: new Date(), staffMessageByUserId: ctx.user!.userId, staffMessageText: message },
        include: orderInclude
      });

      const customerUserId = (updated.customer as any)?.userId ?? null;
      if (customerUserId) {
        await prisma.notification.create({
          data: {
            title: "Order message",
            message,
            type: NotificationType.INFO,
            senderId: ctx.user!.userId,
            receiverId: customerUserId,
            serviceCentreId: updated.serviceCentreId ?? null
          }
        });
      }

      await logActivity(ctx, { module: "ORDERS", action: "ORDER_MESSAGE_SENT", description: `Staff messaged customer for order ${order.id}` });
      return updated;
    },

    transferOrder: async (_: unknown, args: { orderId: string; serviceCentreId: string }, ctx: RequestContext) => {
      assertAnyRole(ctx, [RoleName.ADMIN, RoleName.MANAGER]);
      await ensureOrderTransferSchema();
      const orderId = String(args.orderId ?? "").trim();
      const toCentreId = String(args.serviceCentreId ?? "").trim();
      if (!orderId || !toCentreId) throw new Error("INVALID_INPUT");

      const existing = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true, serviceCentre: true } });
      if (!existing) throw new Error("NOT_FOUND");
      if (!existing.serviceCentreId) throw new Error("SERVICE_CENTRE_REQUIRED");
      enforceCentreScope(ctx, existing.serviceCentreId);

      const transferableStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.STAFF_COMPLETED, OrderStatus.CUSTOMER_REJECTED];
      if (!transferableStatuses.includes(existing.status)) {
        throw new Error("INVALID_STATUS");
      }

      const toCentre = await prisma.serviceCentre.findUnique({ where: { id: toCentreId } });
      if (!toCentre) throw new Error("SERVICE_CENTRE_NOT_FOUND");
      if (toCentre.status !== CentreStatus.ACTIVE) throw new Error("SERVICE_CENTRE_INACTIVE");
      if (toCentreId === existing.serviceCentreId) throw new Error("SAME_SERVICE_CENTRE");

      // Keep compatibility even if Prisma Client wasn't regenerated yet:
      // - update `serviceCentreId` via Prisma (existing column)
      // - set transfer metadata via raw SQL (new columns)
      const updated = await prisma.order.update({
        where: { id: existing.id },
        data: { serviceCentreId: toCentreId },
        include: orderInclude
      });

      const transferredAt = new Date();
      await prisma.$executeRawUnsafe(
        `UPDATE "Order"
         SET "transferredAt" = $1,
             "transferredByUserId" = $2,
             "transferredFromServiceCentreId" = $3,
             "transferredToServiceCentreId" = $4
         WHERE "id" = $5`,
        transferredAt,
        ctx.user!.userId,
        existing.serviceCentreId,
        toCentreId,
        existing.id
      );

      // Notify destination centre staff/manager.
      const destUsers = await prisma.user.findMany({
        where: { serviceCentreId: toCentreId, status: UserStatus.ACTIVE, role: { name: { in: [RoleName.MANAGER, RoleName.STAFF] } } },
        select: { id: true }
      });
      if (destUsers.length) {
        await prisma.notification.createMany({
          data: destUsers.map((u) => ({
            title: "Order transferred",
            message: `Order ${updated.id} was transferred to your centre.`,
            type: NotificationType.TASK,
            senderId: ctx.user!.userId,
            receiverId: u.id,
            serviceCentreId: toCentreId
          }))
        });
      }

      // Notify customer.
      const customerUserId = (updated.customer as any)?.userId ?? null;
      if (customerUserId) {
        await prisma.notification.create({
          data: {
            title: "Order update",
            message: `Your order ${updated.id} was transferred to ${toCentre.centreName}.`,
            type: NotificationType.INFO,
            senderId: ctx.user!.userId,
            receiverId: customerUserId,
            serviceCentreId: toCentreId
          }
        });
      }

      await logActivity(ctx, { module: "ORDERS", action: "ORDER_TRANSFERRED", description: `Transferred order ${existing.id} to centre ${toCentreId}` });
      return updated;
    },

    deleteOrder: async (_: unknown, args: { orderId: string }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      await ensureOrderTransferSchema();
      const order = await prisma.order.findUnique({
        where: { id: args.orderId },
        include: { customer: true, serviceCentre: true }
      });
      if (!order) return true;
      const activeStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.STAFF_COMPLETED];
      if (activeStatuses.includes(order.status)) throw new Error("CANNOT_DELETE_ACTIVE_ORDER");

      if (!isAdmin(ctx)) {
        const role = ctx.user?.roleName;
        if (role === RoleName.CUSTOMER) {
          const customer = await getCustomerForUserOrThrow(ctx.user!.userId);
          if (order.customerId !== customer.id) throw new Error("FORBIDDEN");
          const deletableCustomerStatuses: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CUSTOMER_REJECTED, OrderStatus.CANCELLED];
          if (!deletableCustomerStatuses.includes(order.status)) throw new Error("FORBIDDEN");
        } else if (role === RoleName.MANAGER || role === RoleName.STAFF) {
          // Staff/manager can delete only finished/rejected/cancelled orders from their own service centre.
          enforceCentreScope(ctx, order.serviceCentreId ?? null);
          const deletableStaffStatuses: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CUSTOMER_REJECTED, OrderStatus.CANCELLED];
          if (!deletableStaffStatuses.includes(order.status)) throw new Error("FORBIDDEN");
        } else {
          throw new Error("FORBIDDEN");
        }
      }

      // If feedback exists, detach it (orderId is nullable) before deleting the order.
      await prisma.feedback.updateMany({ where: { orderId: order.id }, data: { orderId: null } });
      await prisma.order.delete({ where: { id: order.id } });
      await logActivity(ctx, { module: "ORDERS", action: "ORDER_DELETED", description: `Deleted order ${order.id}` });
      return true;
    },

    createUser: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      if (!canManageUsers(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
      if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "MANAGE_USERS" });
      const input = args.input as any;

      let serviceCentreId: string | null = input.serviceCentreId ?? null;
      if (isManager(ctx)) serviceCentreId = enforceManagerCentre(ctx);
      if (delegatedCentreId) serviceCentreId = delegatedCentreId;

      if ((isManager(ctx) || delegatedCentreId) && input.role !== RoleName.STAFF) throw new Error("FORBIDDEN");
      if (!isAdmin(ctx) && input.role === RoleName.ADMIN) throw new Error("FORBIDDEN");

      const role = await prisma.role.findUnique({ where: { name: input.role } });
      if (!role) throw new Error("INVALID_ROLE");

      const created = await prisma.user.create({
        data: {
          email: String(input.email).trim().toLowerCase(),
          phone: input.phone?.trim() || null,
          username: input.username?.trim() || null,
          fullName: String(input.fullName).trim(),
          passwordHash: await hashPassword(String(input.password)),
          roleId: role.id,
          serviceCentreId,
          status: UserStatus.ACTIVE,
          address: input.address?.trim() || null,
          profilePhoto: input.profilePhoto?.trim() || null
        },
        include: { role: true, serviceCentre: true }
      });

      await logActivity(ctx, { module: "USER_MANAGEMENT", action: "USER_CREATED", description: `Created user ${created.email} (${created.role.name})` });
      return created;
    },

    updateUser: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      if (!canManageUsers(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
      if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "MANAGE_USERS" });

      const existing = await prisma.user.findUnique({ where: { id: args.id }, include: { role: true, serviceCentre: true } });
      if (!existing) throw new Error("NOT_FOUND");
      if (isManager(ctx) || delegatedCentreId) {
        const centreId = delegatedCentreId ?? enforceManagerCentre(ctx);
        if (existing.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
        if (existing.role.name !== RoleName.STAFF) throw new Error("FORBIDDEN");
      }

      const input = args.input as any;
      if (input.role) {
        if (isManager(ctx)) throw new Error("FORBIDDEN");
        if (!isAdmin(ctx) && input.role === RoleName.ADMIN) throw new Error("FORBIDDEN");
      }
      if ((isManager(ctx) || delegatedCentreId) && input.status === UserStatus.DELETED) throw new Error("FORBIDDEN");

      let serviceCentreId: string | null | undefined = input.serviceCentreId;
      if (isManager(ctx)) serviceCentreId = enforceManagerCentre(ctx);
      if (delegatedCentreId) serviceCentreId = delegatedCentreId;

      const roleId = input.role ? (await prisma.role.findUniqueOrThrow({ where: { name: input.role } })).id : undefined;
      const passwordHash = input.password ? await hashPassword(String(input.password)) : undefined;

      const updated = await prisma.user.update({
        where: { id: args.id },
        data: {
          fullName: input.fullName?.trim() ?? undefined,
          email: input.email ? String(input.email).trim().toLowerCase() : undefined,
          phone: input.phone?.trim() ?? undefined,
          username: input.username?.trim() ?? undefined,
          passwordHash,
          roleId,
          serviceCentreId,
          status: input.status ?? undefined,
          address: input.address?.trim() ?? undefined,
          profilePhoto: input.profilePhoto?.trim() ?? undefined,
          deletedAt: input.status === UserStatus.DELETED ? new Date() : undefined
        },
        include: { role: true, serviceCentre: true }
      });

      await logActivity(ctx, { module: "USER_MANAGEMENT", action: "USER_UPDATED", description: `Updated user ${updated.email}` });
      return updated;
    },

    suspendUser: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      if (!canManageUsers(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
      if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "MANAGE_USERS" });
      const existing = await prisma.user.findUnique({ where: { id: args.id }, include: { role: true } });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.role.name === RoleName.ADMIN && !isAdmin(ctx)) throw new Error("FORBIDDEN");
      if (isManager(ctx) || delegatedCentreId) {
        const centreId = delegatedCentreId ?? enforceManagerCentre(ctx);
        if (existing.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
        if (existing.role.name !== RoleName.STAFF) throw new Error("FORBIDDEN");
        if (existing.id === ctx.user!.userId) throw new Error("FORBIDDEN");
      }

      const updated = await prisma.user.update({ where: { id: args.id }, data: { status: UserStatus.SUSPENDED }, include: { role: true, serviceCentre: true } });
      await logActivity(ctx, { module: "USER_MANAGEMENT", action: "USER_SUSPENDED", description: `Suspended user ${updated.email}` });
      return updated;
    },

    activateUser: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      if (!canManageUsers(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
      if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "MANAGE_USERS" });
      const existing = await prisma.user.findUnique({ where: { id: args.id }, include: { role: true } });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.role.name === RoleName.ADMIN && !isAdmin(ctx)) throw new Error("FORBIDDEN");
      if (isManager(ctx) || delegatedCentreId) {
        const centreId = delegatedCentreId ?? enforceManagerCentre(ctx);
        if (existing.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
        if (existing.role.name !== RoleName.STAFF) throw new Error("FORBIDDEN");
        if (existing.id === ctx.user!.userId) throw new Error("FORBIDDEN");
      }

      const updated = await prisma.user.update({
        where: { id: args.id },
        data: { status: UserStatus.ACTIVE, deletedAt: null },
        include: { role: true, serviceCentre: true }
      });
      await logActivity(ctx, { module: "USER_MANAGEMENT", action: "USER_ACTIVATED", description: `Activated user ${updated.email}` });
      return updated;
    },

    deleteUser: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      if (!canManageUsers(ctx)) throw new Error("FORBIDDEN");
      const existing = await prisma.user.findUnique({ where: { id: args.id }, include: { role: true } });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.role.name === RoleName.ADMIN && !isAdmin(ctx)) throw new Error("FORBIDDEN");
      if (isManager(ctx)) throw new Error("FORBIDDEN");

      const updated = await prisma.user.update({
        where: { id: args.id },
        data: { status: UserStatus.DELETED, deletedAt: new Date() },
        include: { role: true, serviceCentre: true }
      });
      await logActivity(ctx, { module: "USER_MANAGEMENT", action: "USER_DELETED", description: `Deleted user ${updated.email}` });
      return updated;
    },

    sendNotification: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const input = args.input as any;
      const senderId = ctx.user!.userId;

      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      const isDirectMessage = Boolean(input.receiverId);

      // Anyone can send a direct message to one user (used by the in-app "reply" dialog).
      // Broadcast capabilities remain restricted to admin/manager (or delegated staff).
      if (!isDirectMessage) {
        if (!isAdmin(ctx) && !isManager(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
        if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "SEND_NOTIFICATIONS" });
      } else {
        if (input.sendToAll || input.targetRole || input.serviceCentreId) throw new Error("FORBIDDEN");
      }

      let centreId: string | null = input.serviceCentreId ?? null;
      if (isManager(ctx)) centreId = enforceManagerCentre(ctx);
      if (delegatedCentreId) centreId = delegatedCentreId;

      if (input.sendToAll && !isAdmin(ctx)) throw new Error("FORBIDDEN");
      if (input.targetRole && (isManager(ctx) || delegatedCentreId)) throw new Error("FORBIDDEN");

      const type = (input.type ?? NotificationType.INFO) as NotificationType;
      const title = String(input.title ?? "").trim();
      const message = String(input.message ?? "").trim();
      if (!title || !message) throw new Error("INVALID_INPUT");

      if (input.receiverId) {
        const receiver = await prisma.user.findUnique({ where: { id: input.receiverId }, include: { role: true } });
        if (!receiver) throw new Error("NOT_FOUND");
        if (isManager(ctx) && receiver.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
        await prisma.notification.create({
          data: { title, message, type, senderId, receiverId: receiver.id, serviceCentreId: receiver.serviceCentreId ?? null }
        });
      } else if (input.sendToAll) {
        const users = await prisma.user.findMany({ where: { status: UserStatus.ACTIVE }, select: { id: true, serviceCentreId: true } });
        await prisma.notification.createMany({
          data: users.map((u) => ({ title, message, type, senderId, receiverId: u.id, serviceCentreId: u.serviceCentreId ?? null }))
        });
      } else if (input.targetRole) {
        const users = await prisma.user.findMany({
          where: { role: { name: input.targetRole }, status: UserStatus.ACTIVE },
          select: { id: true, serviceCentreId: true }
        });
        await prisma.notification.createMany({
          data: users.map((u) => ({ title, message, type, senderId, receiverId: u.id, serviceCentreId: u.serviceCentreId ?? null, targetRole: input.targetRole }))
        });
      } else {
        if (!centreId) throw new Error("SERVICE_CENTRE_REQUIRED");
        const users = await prisma.user.findMany({ where: { serviceCentreId: centreId, status: UserStatus.ACTIVE }, select: { id: true } });
        await prisma.notification.createMany({
          data: users.map((u) => ({ title, message, type, senderId, receiverId: u.id, serviceCentreId: centreId }))
        });
      }

      await logActivity(ctx, { module: "NOTIFICATIONS", action: "MESSAGE_SENT", description: `Sent notification: ${title}` });
      return true;
    },

    markNotificationRead: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const n = await prisma.notification.findUnique({ where: { id: args.id } });
      if (!n || n.receiverId !== ctx.user!.userId) throw new Error("FORBIDDEN");
      return prisma.notification.update({
        where: { id: args.id },
        data: { isRead: true },
        include: { sender: { include: { role: true, serviceCentre: true } }, receiver: { include: { role: true, serviceCentre: true } }, serviceCentre: true }
      });
    },

    markAllNotificationsRead: async (_: unknown, __: unknown, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      await prisma.notification.updateMany({ where: { receiverId: ctx.user!.userId, isRead: false }, data: { isRead: true } });
      return true;
    },
    deleteNotification: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const n = await prisma.notification.findUnique({ where: { id: args.id } });
      if (!n) return true;
      const me = ctx.user!.userId;
      if (n.receiverId !== me && n.senderId !== me) throw new Error("FORBIDDEN");
      await prisma.notification.delete({ where: { id: args.id } });
      return true;
    },

    createDuty: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const delegatedCentreId = ctx.user?.roleName === RoleName.STAFF ? (ctx.user.serviceCentreId ?? null) : null;
      if (!isManager(ctx) && !isAdmin(ctx) && !delegatedCentreId) throw new Error("FORBIDDEN");
      if (delegatedCentreId) await assertManagerOrDelegated({ ctx, serviceCentreId: delegatedCentreId, code: "ASSIGN_DUTIES" });
      const input = args.input as any;

      const assignedTo = await prisma.user.findUnique({ where: { id: input.assignedToUserId }, include: { role: true } });
      if (!assignedTo) throw new Error("NOT_FOUND");
      const centreId = isManager(ctx) ? enforceManagerCentre(ctx) : delegatedCentreId ?? assignedTo.serviceCentreId;
      if (!centreId) throw new Error("SERVICE_CENTRE_REQUIRED");
      if (assignedTo.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      if (!([RoleName.STAFF, RoleName.MANAGER] as RoleName[]).includes(assignedTo.role.name)) throw new Error("FORBIDDEN");

      const duty = await prisma.duty.create({
        data: {
          title: String(input.title).trim(),
          description: input.description?.trim() || null,
          priority: (input.priority ?? DutyPriority.MEDIUM) as DutyPriority,
          status: DutyStatus.PENDING,
          startDate: input.startDate ?? null,
          dueDate: input.dueDate ?? null,
          assignedToUserId: assignedTo.id,
          assignedByUserId: ctx.user!.userId,
          serviceCentreId: centreId
        },
        include: {
          assignedToUser: { include: { role: true, serviceCentre: true } },
          assignedByUser: { include: { role: true, serviceCentre: true } },
          serviceCentre: true,
          comments: { include: { user: { include: { role: true, serviceCentre: true } } }, orderBy: { createdAt: "asc" } }
        }
      });

      await prisma.notification.create({
        data: {
          title: `New duty: ${duty.title}`,
          message: duty.description ?? "You have a new duty assigned.",
          type: NotificationType.TASK,
          senderId: ctx.user!.userId,
          receiverId: assignedTo.id,
          serviceCentreId: centreId
        }
      });

      await logActivity(ctx, { module: "DUTIES", action: "DUTY_ASSIGNED", description: `Assigned duty '${duty.title}' to ${assignedTo.fullName}` });
      return duty;
    },

    updateDuty: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const existing = await prisma.duty.findUnique({ where: { id: args.id } });
      if (!existing) throw new Error("NOT_FOUND");

      if (isAdmin(ctx)) {
        // ok
      } else if (isManager(ctx)) {
        const centreId = enforceManagerCentre(ctx);
        if (existing.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      } else {
        if (existing.assignedToUserId !== ctx.user!.userId) throw new Error("FORBIDDEN");
      }

      const input = args.input as any;
      const updated = await prisma.duty.update({
        where: { id: args.id },
        data: {
          title: input.title?.trim() ?? undefined,
          description: input.description?.trim() ?? undefined,
          priority: input.priority ?? undefined,
          status: input.status ?? undefined,
          startDate: input.startDate ?? undefined,
          dueDate: input.dueDate ?? undefined
        },
        include: {
          assignedToUser: { include: { role: true, serviceCentre: true } },
          assignedByUser: { include: { role: true, serviceCentre: true } },
          serviceCentre: true,
          comments: { include: { user: { include: { role: true, serviceCentre: true } } }, orderBy: { createdAt: "asc" } }
        }
      });

      await logActivity(ctx, { module: "DUTIES", action: "DUTY_UPDATED", description: `Updated duty '${updated.title}'` });
      return updated;
    },

    addDutyComment: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const input = args.input as any;
      const duty = await prisma.duty.findUnique({ where: { id: input.dutyId } });
      if (!duty) throw new Error("NOT_FOUND");
      if (isManager(ctx)) {
        const centreId = enforceManagerCentre(ctx);
        if (duty.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      } else if (!isAdmin(ctx)) {
        if (duty.assignedToUserId !== ctx.user!.userId) throw new Error("FORBIDDEN");
      }
      const comment = await prisma.dutyComment.create({
        data: { dutyId: duty.id, userId: ctx.user!.userId, message: String(input.message ?? "").trim() },
        include: { duty: true, user: { include: { role: true, serviceCentre: true } } }
      });
      await logActivity(ctx, { module: "DUTIES", action: "DUTY_COMMENT_ADDED", description: `Commented on duty '${duty.title}'` });
      return comment;
    },

    createHandover: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      if (!isManager(ctx)) throw new Error("FORBIDDEN");
      const centreId = enforceManagerCentre(ctx);
      const input = args.input as any;

      const staff = await prisma.user.findUnique({ where: { id: input.assignedStaffId }, include: { role: true } });
      if (!staff) throw new Error("NOT_FOUND");
      if (staff.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      if (staff.role.name !== RoleName.STAFF) throw new Error("FORBIDDEN");

      const permissions: string[] = Array.isArray(input.permissions) ? input.permissions.map((x: any) => String(x)).filter(Boolean) : [];
      if (!permissions.length) throw new Error("INVALID_INPUT");

      const rawStart = new Date(input.startDate);
      const rawEnd = new Date(input.endDate);
      if (!Number.isFinite(rawStart.valueOf()) || !Number.isFinite(rawEnd.valueOf())) throw new Error("INVALID_INPUT");
      let startDate = rawStart;
      let endDate = rawEnd;
      // If the client sent date-only values (UTC-midnight), expand to full local days.
      if (isUtcMidnight(rawStart) && isUtcMidnight(rawEnd)) {
        startDate = startOfDay(rawStart);
        endDate = endOfDay(rawEnd);
      }
      if (endDate < startDate) throw new Error("INVALID_INPUT");

      const handover = await prisma.handover.create({
        data: {
          managerId: ctx.user!.userId,
          assignedStaffId: staff.id,
          serviceCentreId: centreId,
          reason: input.reason?.trim() || null,
          notes: input.notes?.trim() || null,
          startDate,
          endDate,
          status: HandoverStatus.ACTIVE,
          permissions: { create: permissions.map((code) => ({ code })) }
        },
        include: {
          manager: { include: { role: true, serviceCentre: true } },
          assignedStaff: { include: { role: true, serviceCentre: true } },
          serviceCentre: true,
          permissions: true
        }
      });

      await logActivity(ctx, { module: "HANDOVER", action: "HANDOVER_CREATED", description: `Created handover to ${staff.fullName}` });
      return handover;
    },

    setHandoverStatus: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const input = args.input as any;
      const existing = await prisma.handover.findUnique({ where: { id: input.id } });
      if (!existing) throw new Error("NOT_FOUND");

      if (isAdmin(ctx)) {
        // ok
      } else if (isManager(ctx)) {
        const centreId = enforceManagerCentre(ctx);
        if (existing.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      } else {
        throw new Error("FORBIDDEN");
      }

      const updated = await prisma.handover.update({
        where: { id: input.id },
        data: { status: input.status },
        include: {
          manager: { include: { role: true, serviceCentre: true } },
          assignedStaff: { include: { role: true, serviceCentre: true } },
          serviceCentre: true,
          permissions: true
        }
      });

      await logActivity(ctx, { module: "HANDOVER", action: "HANDOVER_STATUS_CHANGED", description: `Handover status set to ${updated.status}` });
      return updated;
    },

    updateHandover: async (_: unknown, args: any, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const input = args.input as any;
      const existing = await prisma.handover.findUnique({ where: { id: input.id }, include: { permissions: true } });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status !== HandoverStatus.ACTIVE) throw new Error("CANNOT_EDIT_INACTIVE_HANDOVER");

      if (isAdmin(ctx)) {
        // ok
      } else if (isManager(ctx)) {
        const centreId = enforceManagerCentre(ctx);
        if (existing.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      } else {
        throw new Error("FORBIDDEN");
      }

      let assignedStaffId: string | undefined = undefined;
      if (input.assignedStaffId !== undefined && input.assignedStaffId !== null) {
        const staff = await prisma.user.findUnique({ where: { id: String(input.assignedStaffId) }, include: { role: true } });
        if (!staff) throw new Error("NOT_FOUND");
        if (staff.serviceCentreId !== existing.serviceCentreId) throw new Error("FORBIDDEN");
        if (staff.role.name !== RoleName.STAFF) throw new Error("FORBIDDEN");
        assignedStaffId = staff.id;
      }

      let startDate: Date | undefined = undefined;
      let endDate: Date | undefined = undefined;
      if (input.startDate !== undefined && input.startDate !== null) {
        const d = new Date(input.startDate);
        if (!Number.isFinite(d.valueOf())) throw new Error("INVALID_INPUT");
        startDate = d;
      }
      if (input.endDate !== undefined && input.endDate !== null) {
        const d = new Date(input.endDate);
        if (!Number.isFinite(d.valueOf())) throw new Error("INVALID_INPUT");
        endDate = d;
      }
      const nextStart = startDate ?? existing.startDate;
      const nextEnd = endDate ?? existing.endDate;
      if (nextEnd < nextStart) throw new Error("INVALID_INPUT");

      const permissions: string[] | undefined =
        input.permissions === undefined || input.permissions === null
          ? undefined
          : Array.isArray(input.permissions)
            ? input.permissions.map((x: any) => String(x)).filter(Boolean)
            : [];
      if (permissions !== undefined && permissions.length === 0) throw new Error("INVALID_INPUT");

      const updated = await prisma.handover.update({
        where: { id: existing.id },
        data: {
          assignedStaffId,
          reason: input.reason === undefined ? undefined : input.reason?.trim() || null,
          notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
          startDate,
          endDate,
          permissions:
            permissions === undefined
              ? undefined
              : {
                  deleteMany: {},
                  create: permissions.map((code) => ({ code }))
                }
        },
        include: {
          manager: { include: { role: true, serviceCentre: true } },
          assignedStaff: { include: { role: true, serviceCentre: true } },
          serviceCentre: true,
          permissions: true
        }
      });

      await logActivity(ctx, { module: "HANDOVER", action: "HANDOVER_UPDATED", description: `Updated handover ${updated.id}` });
      return updated;
    },

    deleteHandover: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      const existing = await prisma.handover.findUnique({ where: { id: args.id } });
      if (!existing) return true;
      if (existing.status === HandoverStatus.ACTIVE) throw new Error("CANNOT_DELETE_ACTIVE_HANDOVER");

      if (isAdmin(ctx)) {
        // ok
      } else if (isManager(ctx)) {
        const centreId = enforceManagerCentre(ctx);
        if (existing.serviceCentreId !== centreId) throw new Error("FORBIDDEN");
      } else {
        throw new Error("FORBIDDEN");
      }

      await prisma.handover.delete({ where: { id: existing.id } });
      await logActivity(ctx, { module: "HANDOVER", action: "HANDOVER_DELETED", description: `Deleted handover ${existing.id}` });
      return true;
    },

    deleteActivityLog: async (_: unknown, args: { id: string }, ctx: RequestContext) => {
      assertAuthenticated(ctx);
      if (!isAdmin(ctx) && !isManager(ctx)) throw new Error("FORBIDDEN");
      const existing = await prisma.activityLog.findUnique({ where: { id: args.id } });
      if (!existing) return true;
      if (isManager(ctx)) {
        const centreId = enforceManagerCentre(ctx);
        if (existing.userId) {
          const u = await prisma.user.findUnique({ where: { id: existing.userId }, select: { serviceCentreId: true } });
          if ((u?.serviceCentreId ?? null) !== centreId) throw new Error("FORBIDDEN");
        } else {
          throw new Error("FORBIDDEN");
        }
      }
      await prisma.activityLog.delete({ where: { id: args.id } });
      return true;
    }
  },

  User: {
    role: (parent: any) => prisma.role.findUniqueOrThrow({ where: { id: parent.roleId } }),
    serviceCentre: (parent: any) => (parent.serviceCentreId ? prisma.serviceCentre.findUnique({ where: { id: parent.serviceCentreId } }) : null)
  },

  Sale: {
    customer: (p: any) => (p.customerId ? prisma.customer.findUnique({ where: { id: p.customerId } }) : null),
    serviceCentre: (p: any) => prisma.serviceCentre.findUniqueOrThrow({ where: { id: p.serviceCentreId } }),
    service: (p: any) => (p.serviceId ? prisma.service.findUnique({ where: { id: p.serviceId } }) : null),
    staffUser: (p: any) => (p.staffUserId ? prisma.user.findUnique({ where: { id: p.staffUserId }, include: { role: true, serviceCentre: true } }) : null)
  },

  StockItem: {
    serviceCentre: (p: any) => prisma.serviceCentre.findUniqueOrThrow({ where: { id: p.serviceCentreId } }),
    inTotal: async (p: any) => {
      if (typeof p.inTotal === "number") return p.inTotal;
      const computed = await stockItemComputed({ serviceCentreId: p.serviceCentreId, stockItemId: p.id });
      return computed.inTotal;
    },
    outTotal: async (p: any) => {
      if (typeof p.outTotal === "number") return p.outTotal;
      const computed = await stockItemComputed({ serviceCentreId: p.serviceCentreId, stockItemId: p.id });
      return computed.outTotal;
    },
    total: async (p: any) => {
      if (typeof p.total === "number") return p.total;
      const computed = await stockItemComputed({ serviceCentreId: p.serviceCentreId, stockItemId: p.id });
      return computed.total;
    },
    balance: async (p: any) => {
      if (typeof p.balance === "number") return p.balance;
      const computed = await stockItemComputed({ serviceCentreId: p.serviceCentreId, stockItemId: p.id });
      return computed.balance;
    }
  },

  StockMovement: {
    serviceCentre: (p: any) => prisma.serviceCentre.findUniqueOrThrow({ where: { id: p.serviceCentreId } }),
    stockItem: (p: any) => prisma.stockItem.findUniqueOrThrow({ where: { id: p.stockItemId }, include: { serviceCentre: true } }),
    createdByUser: (p: any) => (p.createdByUserId ? prisma.user.findUnique({ where: { id: p.createdByUserId }, include: { role: true, serviceCentre: true } }) : null)
  },

  OrderItem: {
    product: (p: any) => prisma.product.findUniqueOrThrow({ where: { id: p.productId } })
  },

  Order: {
    customer: (p: any) => prisma.customer.findUniqueOrThrow({ where: { id: p.customerId } }),
    serviceCentre: (p: any) => (p.serviceCentreId ? prisma.serviceCentre.findUnique({ where: { id: p.serviceCentreId } }) : null),
    transferredAt: async (p: any) => {
      if (p.transferredAt) return p.transferredAt;
      const rows = await prisma.$queryRawUnsafe<Array<{ transferredAt: Date | null }>>(`SELECT "transferredAt" FROM "Order" WHERE "id" = $1`, p.id);
      return rows?.[0]?.transferredAt ?? null;
    },
    transferredFromServiceCentre: async (p: any) => {
      const id = p.transferredFromServiceCentreId ?? (await getTransferMeta(p.id)).transferredFromServiceCentreId;
      return id ? prisma.serviceCentre.findUnique({ where: { id } }) : null;
    },
    transferredToServiceCentre: async (p: any) => {
      const id = p.transferredToServiceCentreId ?? (await getTransferMeta(p.id)).transferredToServiceCentreId;
      return id ? prisma.serviceCentre.findUnique({ where: { id } }) : null;
    },
    transferredByUser: async (p: any) => {
      const id = p.transferredByUserId ?? (await getTransferMeta(p.id)).transferredByUserId;
      return id ? prisma.user.findUnique({ where: { id }, include: { role: true, serviceCentre: true } }) : null;
    },
    items: (p: any) => prisma.orderItem.findMany({ where: { orderId: p.id }, include: { product: true }, orderBy: { createdAt: "asc" } }),
    totalAmount: async (p: any) => {
      const items = Array.isArray(p.items) ? p.items : await prisma.orderItem.findMany({ where: { orderId: p.id } });
      const sum = items.reduce((acc: any, it: any) => acc.add(new Prisma.Decimal(it.lineTotal)), new Prisma.Decimal(0));
      return sum.toString();
    },
    currency: async (p: any) => {
      const first = Array.isArray(p.items) ? p.items[0] : await prisma.orderItem.findFirst({ where: { orderId: p.id }, orderBy: { createdAt: "asc" }, include: { product: true } });
      const prod = (first as any)?.product;
      return prod?.currency ?? "TZS";
    }
  },

  Notification: {
    sender: (p: any) => (p.senderId ? prisma.user.findUnique({ where: { id: p.senderId }, include: { role: true, serviceCentre: true } }) : null),
    receiver: (p: any) => (p.receiverId ? prisma.user.findUnique({ where: { id: p.receiverId }, include: { role: true, serviceCentre: true } }) : null),
    serviceCentre: (p: any) => (p.serviceCentreId ? prisma.serviceCentre.findUnique({ where: { id: p.serviceCentreId } }) : null)
  },

  Duty: {
    assignedToUser: (p: any) => prisma.user.findUniqueOrThrow({ where: { id: p.assignedToUserId }, include: { role: true, serviceCentre: true } }),
    assignedByUser: (p: any) => prisma.user.findUniqueOrThrow({ where: { id: p.assignedByUserId }, include: { role: true, serviceCentre: true } }),
    serviceCentre: (p: any) => prisma.serviceCentre.findUniqueOrThrow({ where: { id: p.serviceCentreId } }),
    comments: (p: any) =>
      prisma.dutyComment.findMany({ where: { dutyId: p.id }, include: { user: { include: { role: true, serviceCentre: true } }, duty: true }, orderBy: { createdAt: "asc" } })
  },

  DutyComment: {
    duty: (p: any) => prisma.duty.findUniqueOrThrow({ where: { id: p.dutyId } }),
    user: (p: any) => prisma.user.findUniqueOrThrow({ where: { id: p.userId }, include: { role: true, serviceCentre: true } })
  },

  Handover: {
    manager: (p: any) => prisma.user.findUniqueOrThrow({ where: { id: p.managerId }, include: { role: true, serviceCentre: true } }),
    assignedStaff: (p: any) => prisma.user.findUniqueOrThrow({ where: { id: p.assignedStaffId }, include: { role: true, serviceCentre: true } }),
    serviceCentre: (p: any) => prisma.serviceCentre.findUniqueOrThrow({ where: { id: p.serviceCentreId } }),
    permissions: (p: any) => prisma.handoverPermission.findMany({ where: { handoverId: p.id }, orderBy: { code: "asc" } })
  },

  HandoverPermission: {},

  ActivityLog: {
    user: (p: any) => (p.userId ? prisma.user.findUnique({ where: { id: p.userId }, include: { role: true, serviceCentre: true } }) : null)
  }
};

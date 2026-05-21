import { HandoverStatus, RoleName } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { RequestContext } from "./requestContext.js";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  x.setMilliseconds(-1);
  return x;
}

function isUtcMidnight(d: Date) {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

function isActiveHandoverAt(h: { startDate: Date; endDate: Date }, at: Date) {
  if (h.startDate <= at && h.endDate >= at) return true;
  // Back-compat for older clients that stored date-only values as UTC-midnight.
  if (isUtcMidnight(h.startDate) && isUtcMidnight(h.endDate)) {
    const atDay = startOfDay(at).getTime();
    const startDay = startOfDay(h.startDate).getTime();
    const endDay = startOfDay(h.endDate).getTime();
    return startDay <= atDay && atDay <= endDay;
  }
  return false;
}

export async function hasDelegatedPermission(args: {
  userId: string;
  serviceCentreId: string;
  code: string;
  at?: Date;
}) {
  const at = args.at ?? new Date();
  const atStart = startOfDay(at);
  const atEnd = endOfDay(at);
  const handovers = await prisma.handover.findMany({
    where: {
      assignedStaffId: args.userId,
      serviceCentreId: args.serviceCentreId,
      status: HandoverStatus.ACTIVE,
      // Use day-overlap filters to support both date-only and date-time ranges.
      startDate: { lte: atEnd },
      endDate: { gte: atStart },
      permissions: { some: { code: args.code } }
    },
    select: { startDate: true, endDate: true }
  });
  return handovers.some((h) => isActiveHandoverAt(h, at));
}

export async function delegatedPermissionCodes(args: { userId: string; serviceCentreId: string; at?: Date }) {
  const at = args.at ?? new Date();
  const atStart = startOfDay(at);
  const atEnd = endOfDay(at);
  const handovers = await prisma.handover.findMany({
    where: {
      assignedStaffId: args.userId,
      serviceCentreId: args.serviceCentreId,
      status: HandoverStatus.ACTIVE,
      startDate: { lte: atEnd },
      endDate: { gte: atStart }
    },
    select: {
      startDate: true,
      endDate: true,
      permissions: { select: { code: true } }
    }
  });

  const codes = new Set<string>();
  for (const h of handovers) {
    if (!isActiveHandoverAt(h, at)) continue;
    for (const p of h.permissions) codes.add(p.code);
  }
  return [...codes].sort();
}

export async function assertManagerOrDelegated(args: { ctx: RequestContext; serviceCentreId: string; code: string }) {
  const { ctx, serviceCentreId, code } = args;
  if (!ctx.user) throw new Error("UNAUTHENTICATED");
  if (ctx.user.roleName === RoleName.MANAGER) {
    if (!ctx.user.serviceCentreId) throw new Error("SERVICE_CENTRE_REQUIRED");
    if (ctx.user.serviceCentreId !== serviceCentreId) throw new Error("FORBIDDEN");
    return;
  }
  if (ctx.user.roleName !== RoleName.STAFF) throw new Error("FORBIDDEN");
  if (!ctx.user.serviceCentreId || ctx.user.serviceCentreId !== serviceCentreId) throw new Error("FORBIDDEN");
  const ok = await hasDelegatedPermission({ userId: ctx.user.userId, serviceCentreId, code });
  if (!ok) throw new Error("FORBIDDEN");
}

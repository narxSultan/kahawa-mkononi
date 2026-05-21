import { prisma } from "../db/prisma.js";
import type { RequestContext } from "../auth/requestContext.js";

export async function logActivity(
  ctx: RequestContext,
  args: { action: string; module: string; description: string; userId?: string | null }
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: args.userId ?? ctx.user?.userId ?? null,
        action: args.action,
        module: args.module,
        description: args.description,
        ipAddress: ctx.ipAddress ?? null
      }
    });
  } catch {
    // best-effort logging
  }
}


import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getUserByWorkOSId(
	ctx: QueryCtx | MutationCtx,
	workosId: string
) {
	const user = await ctx.db
		.query("users")
		.withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
		.unique();

	return user;
}

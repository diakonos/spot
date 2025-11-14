import {
	customAction,
	customMutation,
	customQuery,
} from "convex-helpers/server/customFunctions";
import { createConvexError } from "../src/lib/networking";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, action, mutation, query } from "./_generated/server";
import { getUserByWorkOSId } from "./fn/users";

export const authedQuery = customQuery(query, {
	args: {},
	input: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw createConvexError(401, "Unauthorized");
		}
		const user = await getUserByWorkOSId(ctx, identity.subject);
		if (!user) {
			throw createConvexError(401, "Unauthorized");
		}
		return { ctx: { ...ctx, userId: user._id }, args };
	},
});

export const authedMutation = customMutation(mutation, {
	args: {},
	input: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw createConvexError(401, "Unauthorized");
		}
		const user = await getUserByWorkOSId(ctx, identity.subject);
		if (!user) {
			throw createConvexError(401, "Unauthorized");
		}
		return { ctx: { ...ctx, userId: user._id }, args };
	},
});

export const authedAction = customAction(action, {
	args: {},
	input: async (
		ctx,
		args
	): Promise<{
		ctx: ActionCtx & { userId: Id<"users"> };
		args: Record<string, unknown>;
	}> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw createConvexError(401, "Unauthorized");
		}
		const user: Doc<"users"> | null = await ctx.runQuery(
			internal.users.getByWorkOSId,
			{
				workosId: identity.subject,
			}
		);
		if (!user) {
			throw createConvexError(401, "Unauthorized");
		}
		return { ctx: { ...ctx, userId: user._id }, args };
	},
});

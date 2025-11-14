import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getByWorkOSId = internalQuery({
	args: {
		workosId: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
			.unique();
		return user;
	},
});

export const upsertFromWorkOS = internalMutation({
	args: {
		workosId: v.string(),
		email: v.string(),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
	},
	returns: v.id("users"),
	handler: async (ctx, args) => {
		// Try to find existing user by workosId first
		const existingByWorkOS = await ctx.db
			.query("users")
			.withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
			.unique();

		if (existingByWorkOS) {
			// Update existing user
			await ctx.db.patch(existingByWorkOS._id, {
				email: args.email,
				firstName: args.firstName,
				lastName: args.lastName,
			});
			return existingByWorkOS._id;
		}

		// Try to find by email as fallback
		const existingByEmail = await ctx.db
			.query("users")
			.withIndex("by_email", (q) => q.eq("email", args.email))
			.unique();

		if (existingByEmail) {
			// Update existing user and link workosId
			await ctx.db.patch(existingByEmail._id, {
				email: args.email,
				firstName: args.firstName,
				lastName: args.lastName,
				workosId: args.workosId,
			});
			return existingByEmail._id;
		}

		// Create new user
		const userId = await ctx.db.insert("users", {
			email: args.email,
			firstName: args.firstName,
			lastName: args.lastName,
			workosId: args.workosId,
		});
		return userId;
	},
});

export const deleteByWorkOSId = internalMutation({
	args: {
		workosId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
			.unique();

		if (user) {
			await ctx.db.delete(user._id);
		}
		return null;
	},
});

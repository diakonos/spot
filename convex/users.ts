import { v } from "convex/values";
import { normalizeUsername, validateUsername } from "../shared/usernames";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx,
	query,
} from "./_generated/server";
import { authedMutation, authedQuery } from "./functions";

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

export const getByUsername = internalQuery({
	args: {
		username: v.string(),
	},
	handler: async (ctx, args) => {
		const normalized = normalizeUsername(args.username);
		if (!normalized) {
			return null;
		}

		return await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", normalized))
			.unique();
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

const publicUserShape = v.object({
	_id: v.id("users"),
	email: v.string(),
	firstName: v.optional(v.string()),
	lastName: v.optional(v.string()),
	username: v.optional(v.string()),
});

export const getCurrentProfile = authedQuery({
	args: {},
	returns: publicUserShape,
	handler: async (ctx) => {
		const user = await ctx.db.get(ctx.userId as Id<"users">);
		if (!user) {
			throw new Error("User not found");
		}
		return {
			_id: user._id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			username: user.username,
		};
	},
});

type ViewerUser = Doc<"users"> | null;

async function getViewerUser(ctx: QueryCtx | MutationCtx): Promise<ViewerUser> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		return null;
	}
	const viewer = await ctx.db
		.query("users")
		.withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
		.unique();
	return viewer ?? null;
}

export const usernameAvailable = query({
	args: {
		username: v.string(),
	},
	returns: v.object({
		available: v.boolean(),
		normalized: v.string(),
		reason: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		const validation = validateUsername(args.username);
		if (!validation.ok) {
			return {
				available: false,
				normalized: validation.username,
				reason: validation.reason,
			};
		}

		const existing = await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", validation.username))
			.unique();

		if (existing) {
			return {
				available: false,
				normalized: validation.username,
				reason: "That username is already taken.",
			};
		}

		return {
			available: true,
			normalized: validation.username,
		};
	},
});

export const setUsername = authedMutation({
	args: {
		desiredUsername: v.string(),
	},
	returns: v.object({
		username: v.string(),
	}),
	handler: async (ctx, args) => {
		const userId = ctx.userId as Id<"users">;
		const user = await ctx.db.get(userId);
		if (!user) {
			throw new Error("User not found");
		}
		if (user.username) {
			throw new Error("Usernames can only be set once.");
		}

		const validation = validateUsername(args.desiredUsername);
		if (!validation.ok) {
			throw new Error(validation.reason);
		}

		const existing = await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", validation.username))
			.unique();
		if (existing) {
			throw new Error("That username is already taken.");
		}

		await ctx.db.patch(userId, {
			username: validation.username,
		});

		return { username: validation.username };
	},
});

export const getPublicProfile = query({
	args: {
		username: v.string(),
	},
	returns: v.union(
		v.null(),
		v.object({
			user: v.object({
				_id: v.id("users"),
				username: v.string(),
				email: v.string(),
				firstName: v.optional(v.string()),
				lastName: v.optional(v.string()),
			}),
			viewerIsOwner: v.boolean(),
		})
	),
	handler: async (ctx, args) => {
		const normalized = normalizeUsername(args.username);
		if (!normalized) {
			return null;
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_username", (q) => q.eq("username", normalized))
			.unique();
		if (!user?.username) {
			return null;
		}

		const viewer = await getViewerUser(ctx);
		const viewerIsOwner = viewer ? viewer._id === user._id : false;

		return {
			user: {
				_id: user._id,
				username: user.username,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
			},
			viewerIsOwner,
		};
	},
});

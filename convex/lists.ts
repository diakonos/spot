import { v } from "convex/values";
import { normalizeUsername } from "../shared/usernames";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { getUserByWorkOSId } from "./fn/users";
import { authedMutation, authedQuery } from "./functions";

const slugify = (input: string) => {
	const base = input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return base || `list-${Date.now()}`;
};

export const createList = authedMutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		visibility: v.optional(v.union(v.literal("private"), v.literal("public"))),
	},
	returns: v.id("place_lists"),
	handler: async (ctx, args) => {
		const visibility = args.visibility ?? "private";
		const baseSlug = slugify(args.name);

		let slugCandidate = baseSlug;
		let suffix = 1;
		while (
			await ctx.db
				.query("place_lists")
				.withIndex("by_user_slug", (q) =>
					q.eq("userId", ctx.userId as Id<"users">).eq("slug", slugCandidate)
				)
				.first()
		) {
			slugCandidate = `${baseSlug}-${suffix}`;
			suffix += 1;
		}

		return await ctx.db.insert("place_lists", {
			userId: ctx.userId as Id<"users">,
			name: args.name,
			slug: slugCandidate,
			description: args.description,
			icon: args.icon,
			visibility,
		});
	},
});

export const addSavedPlaceToList = authedMutation({
	args: {
		listId: v.id("place_lists"),
		savedPlaceId: v.id("saved_places"),
		note: v.optional(v.string()),
	},
	returns: v.id("place_list_entries"),
	handler: async (ctx, args) => {
		const list = await ctx.db.get(args.listId);
		if (!list || list.userId !== (ctx.userId as Id<"users">)) {
			throw new Error("List not found");
		}

		const savedPlace = await ctx.db.get(args.savedPlaceId);
		if (!savedPlace || savedPlace.userId !== (ctx.userId as Id<"users">)) {
			throw new Error("Saved place not found");
		}

		const existingEntry = await ctx.db
			.query("place_list_entries")
			.withIndex("by_saved_place_and_list", (q) =>
				q.eq("savedPlaceId", args.savedPlaceId).eq("listId", args.listId)
			)
			.first();

		if (existingEntry) {
			return existingEntry._id;
		}

		const lastEntry = await ctx.db
			.query("place_list_entries")
			.withIndex("by_list_and_position", (q) => q.eq("listId", args.listId))
			.order("desc")
			.first();

		const position = (lastEntry?.position ?? 0) + 1;

		return await ctx.db.insert("place_list_entries", {
			listId: args.listId,
			savedPlaceId: args.savedPlaceId,
			placeId: savedPlace.placeId,
			note: args.note,
			position,
		});
	},
});

const placeSummaryValidator = v.object({
	_id: v.id("places"),
	name: v.string(),
	providerPlaceId: v.string(),
	formattedAddress: v.optional(v.string()),
	rating: v.optional(v.number()),
});

export const getListsForCurrentUser = authedQuery({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("place_lists"),
			name: v.string(),
			slug: v.string(),
			description: v.optional(v.string()),
			visibility: v.union(v.literal("private"), v.literal("public")),
			itemCount: v.number(),
		})
	),
	handler: async (ctx) => {
		const lists = await ctx.db
			.query("place_lists")
			.withIndex("by_user", (q) => q.eq("userId", ctx.userId as Id<"users">))
			.collect();

		const results: Array<{
			_id: Id<"place_lists">;
			name: string;
			slug: string;
			description?: string;
			visibility: "private" | "public";
			itemCount: number;
		}> = [];
		for (const list of lists) {
			const count = await countListEntries(ctx, list._id);
			results.push({
				_id: list._id,
				name: list.name,
				slug: list.slug,
				description: list.description,
				visibility: list.visibility,
				itemCount: count,
			});
		}

		return results;
	},
});

export const getListsWithSavedPlaceState = authedQuery({
	args: {
		providerPlaceId: v.string(),
	},
	returns: v.object({
		savedPlaceId: v.union(v.null(), v.id("saved_places")),
		placeId: v.union(v.null(), v.id("places")),
		lists: v.array(
			v.object({
				_id: v.id("place_lists"),
				name: v.string(),
				slug: v.string(),
				description: v.optional(v.string()),
				visibility: v.union(v.literal("private"), v.literal("public")),
				itemCount: v.number(),
				isMember: v.boolean(),
				entryId: v.union(v.null(), v.id("place_list_entries")),
			})
		),
	}),
	handler: async (ctx, args) => {
		const lists = await ctx.db
			.query("place_lists")
			.withIndex("by_user", (q) => q.eq("userId", ctx.userId as Id<"users">))
			.collect();

		const place = await ctx.db
			.query("places")
			.withIndex("by_provider_id", (q) =>
				q.eq("provider", "google").eq("providerPlaceId", args.providerPlaceId)
			)
			.first();

		if (!place) {
			return {
				savedPlaceId: null,
				placeId: null,
				lists: await Promise.all(
					lists.map(async (list) => ({
						_id: list._id,
						name: list.name,
						slug: list.slug,
						description: list.description,
						visibility: list.visibility,
						itemCount: await countListEntries(ctx, list._id),
						isMember: false,
						entryId: null,
					}))
				),
			};
		}

		const savedPlace = await ctx.db
			.query("saved_places")
			.withIndex("by_user_place", (q) =>
				q.eq("userId", ctx.userId as Id<"users">).eq("placeId", place._id)
			)
			.first();

		const membership = new Map<Id<"place_lists">, Id<"place_list_entries">>();
		if (savedPlace) {
			for await (const entry of ctx.db
				.query("place_list_entries")
				.withIndex("by_saved_place_and_list", (q) =>
					q.eq("savedPlaceId", savedPlace._id)
				)) {
				membership.set(entry.listId, entry._id);
			}
		}

		const listsWithState = await Promise.all(
			lists.map(async (list) => ({
				_id: list._id,
				name: list.name,
				slug: list.slug,
				description: list.description,
				visibility: list.visibility,
				itemCount: await countListEntries(ctx, list._id),
				isMember: membership.has(list._id),
				entryId: membership.get(list._id) ?? null,
			}))
		);

		return {
			savedPlaceId: savedPlace?._id ?? null,
			placeId: place._id,
			lists: listsWithState,
		};
	},
});

const listVisibilityValidator = v.union(
	v.literal("private"),
	v.literal("public")
);

async function countListEntries(
	ctx: QueryCtx | MutationCtx,
	listId: Id<"place_lists">
) {
	let count = 0;
	for await (const _entry of ctx.db
		.query("place_list_entries")
		.withIndex("by_list_and_position", (q) => q.eq("listId", listId))) {
		count += 1;
	}
	return count;
}

async function getViewerUser(
	ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		return null;
	}
	return await getUserByWorkOSId(ctx, identity.subject);
}

async function getUserByUsername(ctx: QueryCtx, username: string) {
	const normalized = normalizeUsername(username);
	if (!normalized) {
		return null;
	}
	return await ctx.db
		.query("users")
		.withIndex("by_username", (q) => q.eq("username", normalized))
		.unique();
}

export const getListsForProfile = query({
	args: {
		username: v.string(),
	},
	returns: v.union(
		v.null(),
		v.object({
			owner: v.object({
				_id: v.id("users"),
				username: v.string(),
				firstName: v.optional(v.string()),
				lastName: v.optional(v.string()),
			}),
			viewerIsOwner: v.boolean(),
			lists: v.array(
				v.object({
					_id: v.id("place_lists"),
					name: v.string(),
					slug: v.string(),
					description: v.optional(v.string()),
					visibility: listVisibilityValidator,
					itemCount: v.number(),
				})
			),
		})
	),
	handler: async (ctx, args) => {
		const owner = await getUserByUsername(ctx, args.username);
		if (!owner?.username) {
			return null;
		}

		const viewer = await getViewerUser(ctx);
		const viewerIsOwner = viewer ? viewer._id === owner._id : false;

		const listsQuery = ctx.db
			.query("place_lists")
			.withIndex("by_user", (q) => q.eq("userId", owner._id));

		const lists: Array<{
			_id: Id<"place_lists">;
			name: string;
			slug: string;
			description?: string;
			visibility: "private" | "public";
			itemCount: number;
		}> = [];

		for await (const list of listsQuery) {
			if (!viewerIsOwner && list.visibility !== "public") {
				continue;
			}
			const itemCount = await countListEntries(ctx, list._id);
			lists.push({
				_id: list._id,
				name: list.name,
				slug: list.slug,
				description: list.description,
				visibility: list.visibility,
				itemCount,
			});
		}

		return {
			owner: {
				_id: owner._id,
				username: owner.username,
				firstName: owner.firstName,
				lastName: owner.lastName,
			},
			viewerIsOwner,
			lists,
		};
	},
});

export const getListBySlugForProfile = query({
	args: {
		username: v.string(),
		slug: v.string(),
	},
	returns: v.union(
		v.null(),
		v.object({
			owner: v.object({
				_id: v.id("users"),
				username: v.string(),
				firstName: v.optional(v.string()),
				lastName: v.optional(v.string()),
			}),
			viewerIsOwner: v.boolean(),
			list: v.object({
				_id: v.id("place_lists"),
				name: v.string(),
				slug: v.string(),
				description: v.optional(v.string()),
				visibility: listVisibilityValidator,
			}),
			entries: v.array(
				v.object({
					entryId: v.id("place_list_entries"),
					savedPlaceId: v.id("saved_places"),
					place: v.union(v.null(), placeSummaryValidator),
				})
			),
		})
	),
	handler: async (ctx, args) => {
		const owner = await getUserByUsername(ctx, args.username);
		if (!owner?.username) {
			return null;
		}

		const viewer = await getViewerUser(ctx);
		const viewerIsOwner = viewer ? viewer._id === owner._id : false;

		const list = await ctx.db
			.query("place_lists")
			.withIndex("by_user_slug", (q) =>
				q.eq("userId", owner._id).eq("slug", args.slug)
			)
			.unique();

		if (!list) {
			return null;
		}

		if (!viewerIsOwner && list.visibility !== "public") {
			return null;
		}

		const entries = await ctx.db
			.query("place_list_entries")
			.withIndex("by_list_and_position", (q) => q.eq("listId", list._id))
			.collect();

		const detailedEntries: Array<{
			entryId: Id<"place_list_entries">;
			savedPlaceId: Id<"saved_places">;
			place: {
				_id: Id<"places">;
				name: string;
				providerPlaceId: string;
				formattedAddress?: string;
				rating?: number;
			} | null;
		}> = [];
		for (const entry of entries) {
			const place = entry.placeId ? await ctx.db.get(entry.placeId) : null;
			detailedEntries.push({
				entryId: entry._id,
				savedPlaceId: entry.savedPlaceId,
				place: place
					? {
							_id: place._id,
							name: place.name,
							providerPlaceId: place.providerPlaceId,
							formattedAddress: place.formattedAddress,
							rating: place.rating,
						}
					: null,
			});
		}

		return {
			owner: {
				_id: owner._id,
				username: owner.username,
				firstName: owner.firstName,
				lastName: owner.lastName,
			},
			viewerIsOwner,
			list: {
				_id: list._id,
				name: list.name,
				slug: list.slug,
				description: list.description,
				visibility: list.visibility,
			},
			entries: detailedEntries,
		};
	},
});

export const setSavedPlaceLists = authedMutation({
	args: {
		savedPlaceId: v.id("saved_places"),
		listIds: v.array(v.id("place_lists")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const savedPlace = await ctx.db.get(args.savedPlaceId);
		if (!savedPlace || savedPlace.userId !== (ctx.userId as Id<"users">)) {
			throw new Error("Saved place not found");
		}

		const desiredListIds = new Set<Id<"place_lists">>(args.listIds);

		for (const listId of desiredListIds) {
			const list = await ctx.db.get(listId);
			if (!list || list.userId !== (ctx.userId as Id<"users">)) {
				throw new Error("List not found");
			}
		}

		const existingMembership = new Set<Id<"place_lists">>();
		for await (const entry of ctx.db
			.query("place_list_entries")
			.withIndex("by_saved_place_and_list", (q) =>
				q.eq("savedPlaceId", args.savedPlaceId)
			)) {
			if (!desiredListIds.has(entry.listId)) {
				await ctx.db.delete(entry._id);
				continue;
			}
			existingMembership.add(entry.listId);
		}

		for (const listId of desiredListIds) {
			if (existingMembership.has(listId)) {
				continue;
			}
			const lastEntry = await ctx.db
				.query("place_list_entries")
				.withIndex("by_list_and_position", (q) => q.eq("listId", listId))
				.order("desc")
				.first();
			const position = (lastEntry?.position ?? 0) + 1;
			await ctx.db.insert("place_list_entries", {
				listId,
				savedPlaceId: args.savedPlaceId,
				placeId: savedPlace.placeId,
				position,
			});
		}

		return null;
	},
});

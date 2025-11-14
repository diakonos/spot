import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
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
				.withIndex("by_slug", (q) => q.eq("slug", slugCandidate))
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
			let count = 0;
			for await (const _entry of ctx.db
				.query("place_list_entries")
				.withIndex("by_list_and_position", (q) => q.eq("listId", list._id))) {
				count += 1;
			}
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

export const getListBySlug = query({
	args: {
		slug: v.string(),
	},
	returns: v.union(
		v.null(),
		v.object({
			list: v.object({
				_id: v.id("place_lists"),
				name: v.string(),
				slug: v.string(),
				description: v.optional(v.string()),
				visibility: v.union(v.literal("private"), v.literal("public")),
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
	handler: async (ctx, { slug }) => {
		const list = await ctx.db
			.query("place_lists")
			.withIndex("by_slug", (q) => q.eq("slug", slug))
			.first();

		if (!list) {
			return null;
		}

		const identity = await ctx.auth.getUserIdentity();

		if (list.visibility !== "public") {
			if (!identity) {
				// If the list is not public and the user is not authenticated, return null
				return null;
			}

			const user = await getUserByWorkOSId(ctx, identity?.subject ?? "");
			// If the list is not public and the user is not the owner, return null
			if (user?._id !== list.userId) {
				return null;
			}
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

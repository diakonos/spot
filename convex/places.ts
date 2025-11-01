import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";

/**
 * Internal mutation to upsert a place in the database.
 * Called by actions after fetching place details from Google.
 */
export const upsertPlace = internalMutation({
	args: {
		provider: v.literal("google"),
		providerPlaceId: v.string(),
		name: v.string(),
		displayName: v.optional(
			v.object({ text: v.string(), languageCode: v.optional(v.string()) })
		),
		primaryType: v.optional(v.string()),
		primaryTypeDisplayName: v.optional(
			v.object({ text: v.string(), languageCode: v.optional(v.string()) })
		),
		formattedAddress: v.optional(v.string()),
		addressComponents: v.optional(
			v.array(
				v.object({
					longText: v.string(),
					shortText: v.optional(v.string()),
					types: v.array(v.string()),
					languageCode: v.optional(v.string()),
				})
			)
		),
		location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
		businessStatus: v.optional(
			v.union(
				v.literal("OPERATIONAL"),
				v.literal("CLOSED_TEMPORARILY"),
				v.literal("CLOSED_PERMANENTLY")
			)
		),
		internationalPhoneNumber: v.optional(v.string()),
		nationalPhoneNumber: v.optional(v.string()),
		websiteUri: v.optional(v.string()),
		googleMapsUri: v.optional(v.string()),
		photos: v.optional(
			v.array(
				v.object({
					name: v.string(),
					widthPx: v.number(),
					heightPx: v.number(),
				})
			)
		),
		regularOpeningHours: v.optional(v.any()),
		rating: v.optional(v.number()),
		raw: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("places")
			.withIndex("by_provider_id", (q) =>
				q
					.eq("provider", args.provider)
					.eq("providerPlaceId", args.providerPlaceId)
			)
			.first();

		const placeData = {
			...args,
			lastSyncedAt: Date.now(),
		};

		if (existing) {
			await ctx.db.patch(existing._id, placeData);
			return existing._id;
		}

		return await ctx.db.insert("places", placeData);
	},
});

/**
 * Action to fetch place details from Google and upsert into the database.
 * This is an action because it needs to call another action (fetchPlaceDetails).
 */
export const upsertPlaceFromGoogle = action({
	args: { providerPlaceId: v.string() },
	handler: async (ctx, { providerPlaceId }) => {
		const details = await ctx.runAction(api.google.fetchPlaceDetails, {
			placeId: providerPlaceId,
		});

		await ctx.runMutation(internal.places.upsertPlace, details);
	},
});

/**
 * Internal mutation to save a place for a user.
 * Called by actions after ensuring the place exists.
 */
export const savePlaceForUser = internalMutation({
	args: {
		userId: v.id("users"),
		placeId: v.id("places"),
		tags: v.optional(v.array(v.string())),
		myRating: v.optional(v.number()),
		note: v.optional(v.string()),
	},
	returns: v.id("saved_places"),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("saved_places")
			.withIndex("by_user_place", (q) =>
				q.eq("userId", args.userId).eq("placeId", args.placeId)
			)
			.first();
		if (existing) {
			return existing._id;
		}
		return await ctx.db.insert("saved_places", {
			userId: args.userId,
			placeId: args.placeId,
			tags: args.tags ?? [],
			myRating: args.myRating,
			note: args.note,
		});
	},
});

/**
 * Mutation to save a place for a user.
 * Accepts place data from the frontend (from Google API) and saves immediately.
 * Then schedules an action to fetch canonical data from Google in the background.
 */
export const savePlaceForOwner = mutation({
	args: {
		userId: v.id("users"),
		// Place data from Google API (partial, will be enriched by background sync)
		providerPlaceId: v.string(),
		name: v.string(),
		displayName: v.optional(
			v.object({ text: v.string(), languageCode: v.optional(v.string()) })
		),
		formattedAddress: v.optional(v.string()),
		location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
		rating: v.optional(v.number()),
		// User-specific data
		tags: v.optional(v.array(v.string())),
		myRating: v.optional(v.number()),
		note: v.optional(v.string()),
	},
	returns: v.id("saved_places"),
	handler: async (ctx, args) => {
		// First, upsert the place with the data we have from the frontend
		const existingPlace = await ctx.db
			.query("places")
			.withIndex("by_provider_id", (q) =>
				q.eq("provider", "google").eq("providerPlaceId", args.providerPlaceId)
			)
			.first();

		const placeData = {
			provider: "google" as const,
			providerPlaceId: args.providerPlaceId,
			name: args.name,
			displayName: args.displayName,
			formattedAddress: args.formattedAddress,
			location: args.location,
			rating: args.rating,
			lastSyncedAt: Date.now(),
		};

		let placeId: Id<"places">;
		if (existingPlace) {
			await ctx.db.patch(existingPlace._id, placeData);
			placeId = existingPlace._id;
		} else {
			placeId = await ctx.db.insert("places", placeData);
		}

		// Save the place for the user
		const existingSave = await ctx.db
			.query("saved_places")
			.withIndex("by_user_place", (q) =>
				q.eq("userId", args.userId).eq("placeId", placeId)
			)
			.first();

		const savedPlaceId = existingSave
			? existingSave._id
			: await ctx.db.insert("saved_places", {
					userId: args.userId,
					placeId,
					tags: args.tags ?? [],
					myRating: args.myRating,
					note: args.note,
				});

		// Schedule background action to fetch canonical data from Google
		await ctx.scheduler.runAfter(0, api.places.syncPlaceFromGoogle, {
			providerPlaceId: args.providerPlaceId,
		});

		return savedPlaceId;
	},
});

/**
 * Action to sync place data from Google API.
 * Called in the background after a place is saved.
 */
export const syncPlaceFromGoogle = action({
	args: { providerPlaceId: v.string() },
	returns: v.null(),
	handler: async (ctx, { providerPlaceId }) => {
		const details = await ctx.runAction(api.google.fetchPlaceDetails, {
			placeId: providerPlaceId,
		});

		await ctx.runMutation(internal.places.upsertPlace, details);
		return null;
	},
});

export const listSavedPlaces = query({
	args: { userId: v.id("users") },
	handler: async (ctx, { userId }) => {
		const saves = await ctx.db
			.query("saved_places")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const places = await Promise.all(saves.map((s) => ctx.db.get(s.placeId)));
		return saves.map((s, i) => ({
			save: s,
			place: places[i],
		}));
	},
});

export const updateSavedPlace = mutation({
	args: {
		id: v.id("saved_places"),
		tags: v.optional(v.array(v.string())),
		myRating: v.optional(v.number()),
		note: v.optional(v.string()),
	},
	handler: async (ctx, { id, ...rest }) => {
		await ctx.db.patch(id, rest);
		return null;
	},
});

export const removeSavedPlace = mutation({
	args: { id: v.id("saved_places") },
	handler: async (ctx, { id }) => {
		await ctx.db.delete(id);
		return null;
	},
});

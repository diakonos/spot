import { v } from "convex/values";
import { createLogger } from "../src/lib/logger";
import { STALE_THRESHOLD_MS } from "../src/lib/settings";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { syncPlaceToGeospatial } from "./fn/geospatial";
import { convertPlaceToPlaceDetailsResponse } from "./fn/places";

const logger = createLogger("convex/places");

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
			await syncPlaceToGeospatial(ctx, existing._id);
			return existing._id;
		}

		const placeId = await ctx.db.insert("places", placeData);
		await syncPlaceToGeospatial(ctx, placeId);
		return placeId;
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

		await syncPlaceToGeospatial(ctx, placeId);

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

export const listSavedPlacesForCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return [];
		}

		// Find user by workosId
		const user = await ctx.db
			.query("users")
			.withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
			.first();

		if (!user) {
			return [];
		}

		const saves = await ctx.db
			.query("saved_places")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
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

/**
 * Action to revalidate a place by fetching fresh data from Google.
 * Called automatically by the query when stale data is detected.
 */
export const revalidateGooglePlace = action({
	args: { providerPlaceId: v.string() },
	returns: v.null(),
	handler: async (ctx, { providerPlaceId }) => {
		// Fetch fresh data from Google and upsert
		await ctx.runAction(api.places.upsertPlaceFromGoogle, {
			providerPlaceId,
		});

		return null;
	},
});

/**
 * Internal query to get a place by provider ID.
 * Used by revalidation action.
 */
export const getPlaceByProviderId = internalQuery({
	args: { providerPlaceId: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			_id: v.id("places"),
			lastSyncedAt: v.number(),
		})
	),
	handler: async (ctx, { providerPlaceId }) => {
		const place = await ctx.db
			.query("places")
			.withIndex("by_provider_id", (q) =>
				q.eq("provider", "google").eq("providerPlaceId", providerPlaceId)
			)
			.first();

		if (!place) {
			return null;
		}

		return {
			_id: place._id,
			lastSyncedAt: place.lastSyncedAt,
		};
	},
});

/**
 * Query to get place details with save status.
 * Automatically triggers revalidation if data is stale (≥24 hours old).
 * Returns null if place doesn't exist in database (client should fallback to Google API).
 */
export const getPlaceDetailsWithSaveStatus = query({
	args: { providerPlaceId: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			place: v.object({
				id: v.string(),
				name: v.string(),
				formatted_address: v.optional(v.string()),
				location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
				rating: v.optional(v.number()),
				user_ratings_total: v.optional(v.number()),
				photos: v.optional(
					v.array(
						v.object({
							name: v.string(),
							widthPx: v.number(),
							heightPx: v.number(),
						})
					)
				),
				website: v.optional(v.string()),
				phone: v.optional(v.string()),
				google_maps_uri: v.optional(v.string()),
			}),
			lastSyncedAt: v.number(),
			isSaved: v.boolean(),
		})
	),
	handler: async (ctx, { providerPlaceId }) => {
		// Get the place from database
		const place = await ctx.db
			.query("places")
			.withIndex("by_provider_id", (q) =>
				q.eq("provider", "google").eq("providerPlaceId", providerPlaceId)
			)
			.first();

		// Return null if place doesn't exist (client will fallback to Google API)
		if (!place) {
			return null;
		}

		// Check if current user has saved this place
		const identity = await ctx.auth.getUserIdentity();
		let isSaved = false;

		if (identity) {
			// Find user by workosId (from token subject)
			const user = await ctx.db
				.query("users")
				.withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
				.first();

			if (user) {
				const savedPlace = await ctx.db
					.query("saved_places")
					.withIndex("by_user_place", (q) =>
						q.eq("userId", user._id).eq("placeId", place._id)
					)
					.first();
				isSaved = !!savedPlace;
			}
		}

		// Convert to PlaceDetailsResponse format
		const placeResponse = convertPlaceToPlaceDetailsResponse(place);

		return {
			place: placeResponse,
			lastSyncedAt: place.lastSyncedAt,
			isSaved,
		};
	},
});

export const revalidatePlace = mutation({
	args: { providerPlaceId: v.string() },
	returns: v.null(),
	handler: async (ctx, { providerPlaceId }) => {
		const place = await ctx.db
			.query("places")
			.withIndex("by_provider_id", (q) =>
				q.eq("provider", "google").eq("providerPlaceId", providerPlaceId)
			)
			.first();

		if (!place) {
			logger.warn(`Place ${providerPlaceId} not found`);
			return null;
		}

		// Check if data is stale and trigger revalidation in background
		const now = Date.now();
		const isStale = now - place.lastSyncedAt >= STALE_THRESHOLD_MS;

		if (isStale) {
			await ctx.scheduler.runAfter(0, api.places.revalidateGooglePlace, {
				providerPlaceId,
			});
		}
	},
});

/**
 * Mutation to save a place for the current authenticated user.
 * If the place doesn't exist in the database, it will be created from the provided data.
 */
export const savePlaceForCurrentUser = mutation({
	args: {
		// Place data from Google API (may be partial)
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
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Not authenticated");
		}

		// Find user by workosId
		const user = await ctx.db
			.query("users")
			.withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
			.first();

		if (!user) {
			throw new Error("User not found");
		}

		// Check if place exists, if not create it
		const existingPlace = await ctx.db
			.query("places")
			.withIndex("by_provider_id", (q) =>
				q.eq("provider", "google").eq("providerPlaceId", args.providerPlaceId)
			)
			.first();

		let placeId: Id<"places">;
		if (existingPlace) {
			placeId = existingPlace._id;
		} else {
			// Create place with provided data
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
			placeId = await ctx.db.insert("places", placeData);

			// Schedule background action to fetch canonical data from Google
			await ctx.scheduler.runAfter(0, api.places.syncPlaceFromGoogle, {
				providerPlaceId: args.providerPlaceId,
			});
		}

		await syncPlaceToGeospatial(ctx, placeId);

		// Save the place for the user
		const existingSave = await ctx.db
			.query("saved_places")
			.withIndex("by_user_place", (q) =>
				q.eq("userId", user._id).eq("placeId", placeId)
			)
			.first();

		if (existingSave) {
			return existingSave._id;
		}

		return await ctx.db.insert("saved_places", {
			userId: user._id,
			placeId,
			tags: args.tags ?? [],
			myRating: args.myRating,
			note: args.note,
		});
	},
});

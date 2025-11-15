import {
	paginationOptsValidator,
	paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
	query,
} from "./_generated/server";
import { syncPlaceToGeospatial } from "./fn/geospatial";
import { convertPlaceToPlaceDetailsResponse } from "./fn/places";
import { authedMutation, authedQuery } from "./functions";

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
export const upsertPlaceFromGoogle = internalAction({
	args: { providerPlaceId: v.string() },
	returns: v.null(),
	handler: async (ctx, { providerPlaceId }) => {
		const details = await ctx.runAction(internal.google.fetchPlaceDetails, {
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
 * Action to sync place data from Google API.
 * Called in the background after a place is saved.
 */
export const syncPlaceFromGoogle = internalAction({
	args: { providerPlaceId: v.string() },
	returns: v.null(),
	handler: async (ctx, { providerPlaceId }) => {
		const details = await ctx.runAction(internal.google.fetchPlaceDetails, {
			placeId: providerPlaceId,
		});

		await ctx.runMutation(internal.places.upsertPlace, details);
		return null;
	},
});

const savedPlaceListItemValidator = v.object({
	save: v.object({
		_id: v.id("saved_places"),
		_creationTime: v.number(),
		userId: v.id("users"),
		placeId: v.id("places"),
		tags: v.optional(v.array(v.string())),
		myRating: v.optional(v.number()),
		note: v.optional(v.string()),
	}),
	place: v.union(
		v.null(),
		v.object({
			_id: v.id("places"),
			_creationTime: v.number(),
			providerPlaceId: v.string(),
			name: v.string(),
			formattedAddress: v.optional(v.string()),
			rating: v.optional(v.number()),
		})
	),
});

export const listSavedPlacesForCurrentUser = authedQuery({
	args: {
		paginationOpts: paginationOptsValidator,
	},
	returns: paginationResultValidator(savedPlaceListItemValidator),
	handler: async (ctx, { paginationOpts }) => {
		const saves = await ctx.db
			.query("saved_places")
			.withIndex("by_user", (q) => q.eq("userId", ctx.userId as Id<"users">))
			.order("desc")
			.paginate(paginationOpts);

		const places = await Promise.all(
			saves.page.map(async (save) => {
				const place = await ctx.db.get(save.placeId);
				if (!place) {
					return null;
				}

				return {
					_id: place._id,
					_creationTime: place._creationTime,
					providerPlaceId: place.providerPlaceId,
					name: place.name,
					formattedAddress: place.formattedAddress,
					rating: place.rating,
				};
			})
		);

		return {
			page: saves.page.map((save, index) => ({
				save,
				place: places[index],
			})),
			isDone: saves.isDone,
			continueCursor: saves.continueCursor,
			splitCursor: saves.splitCursor ?? null,
			pageStatus: saves.pageStatus ?? null,
		};
	},
});

/**
 * Action to revalidate a place by fetching fresh data from Google.
 * Called automatically by the query when stale data is detected.
 */
export const revalidateGooglePlace = internalAction({
	args: { providerPlaceId: v.string() },
	returns: v.null(),
	handler: async (ctx, { providerPlaceId }) => {
		// Fetch fresh data from Google and upsert
		await ctx.runAction(internal.places.upsertPlaceFromGoogle, {
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
			savedPlaceId: v.union(v.null(), v.id("saved_places")),
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

		let savedPlaceId: Id<"saved_places"> | null = null;
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
				if (savedPlace) {
					isSaved = true;
					savedPlaceId = savedPlace._id;
				}
			}
		}

		// Convert to PlaceDetailsResponse format
		const placeResponse = convertPlaceToPlaceDetailsResponse(place);

		return {
			place: placeResponse,
			lastSyncedAt: place.lastSyncedAt,
			isSaved,
			savedPlaceId,
		};
	},
});

/**
 * Mutation to save a place for the current authenticated user.
 * If the place doesn't exist in the database, it will be created from the provided data.
 */
export const savePlaceForCurrentUser = authedMutation({
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
			await ctx.scheduler.runAfter(0, internal.places.syncPlaceFromGoogle, {
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

export const unsaveSavedPlace = authedMutation({
	args: {
		savedPlaceId: v.id("saved_places"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const savedPlace = await ctx.db.get(args.savedPlaceId);
		if (!savedPlace || savedPlace.userId !== (ctx.userId as Id<"users">)) {
			throw new Error("Saved place not found");
		}

		for await (const entry of ctx.db
			.query("place_list_entries")
			.withIndex("by_saved_place_and_list", (q) =>
				q.eq("savedPlaceId", args.savedPlaceId)
			)) {
			await ctx.db.delete(entry._id);
		}

		await ctx.db.delete(args.savedPlaceId);
		return null;
	},
});

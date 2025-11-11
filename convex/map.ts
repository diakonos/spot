import { startSpan } from "@sentry/tanstackstart-react";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { placesGeospatialIndex } from "./geospatial";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export const listPlacesForMap = query({
	args: {
		bounds: v.object({
			north: v.number(),
			south: v.number(),
			east: v.number(),
			west: v.number(),
		}),
		mode: v.union(v.literal("all"), v.literal("saved"), v.literal("none")),
		cursor: v.optional(v.string()),
		limit: v.optional(v.number()),
		highlightProviderPlaceId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		if (args.mode === "none") {
			return { markers: [], nextCursor: undefined };
		}

		const limit = Math.min(Math.max(args.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

		const identity = await ctx.auth.getUserIdentity();
		let userId: Id<"users"> | null = null;
		if (identity) {
			const user = await ctx.db
				.query("users")
				.withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
				.first();
			userId = user?._id ?? null;
		}

		if (args.mode === "saved" && !userId) {
			return { markers: [], nextCursor: undefined };
		}

		let savedPlaceIds = new Set<Id<"places">>();
		if (userId) {
			const savedPlaces = await ctx.db
				.query("saved_places")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.collect();
			savedPlaceIds = new Set(savedPlaces.map((p) => p.placeId));
		}

		if (args.mode === "saved" && savedPlaceIds.size === 0) {
			return { markers: [], nextCursor: undefined };
		}

		const rectangle = {
			west: args.bounds.west,
			south: args.bounds.south,
			east: args.bounds.east,
			north: args.bounds.north,
		};

		const geoResult = await startSpan(
			{ name: "geospatial.queryRectangle" },
			async () =>
				placesGeospatialIndex.query(
					ctx,
					{ shape: { type: "rectangle", rectangle }, limit },
					args.cursor
				)
		);

		const highlightProviderPlaceId = args.highlightProviderPlaceId ?? null;

		const filteredKeys = geoResult.results.filter((result) => {
			if (args.mode !== "saved") {
				return true;
			}
			return savedPlaceIds.has(result.key);
		});

		if (filteredKeys.length === 0) {
			return { markers: [], nextCursor: geoResult.nextCursor ?? undefined };
		}

		const places = await Promise.all(
			filteredKeys.map((marker) => ctx.db.get(marker.key))
		);

		const markers = filteredKeys.flatMap((marker, index) => {
			const place = places[index];
			if (!place?.location) {
				return [];
			}
			const latitude = marker.coordinates.latitude;
			const longitude = marker.coordinates.longitude;
			if (typeof latitude !== "number" || typeof longitude !== "number") {
				return [];
			}
			const isSaved = savedPlaceIds.has(place._id);
			return [
				{
					placeId: place._id,
					providerPlaceId: place.providerPlaceId,
					name: place.name,
					latitude,
					longitude,
					isSaved,
					isHighlighted:
						highlightProviderPlaceId === null
							? false
							: place.providerPlaceId === highlightProviderPlaceId,
				},
			];
		});

		return {
			markers,
			nextCursor: geoResult.nextCursor ?? undefined,
		};
	},
});

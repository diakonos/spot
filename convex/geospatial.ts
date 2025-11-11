import { GeospatialIndex } from "@convex-dev/geospatial";
import { v } from "convex/values";
import type {
	PlaceFilterKeys,
	PlaceGeospatialKey,
} from "../src/types/geospatial";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
	removePlaceFromGeospatial,
	syncPlaceToGeospatial,
} from "./fn/geospatial";

export const placesGeospatialIndex = new GeospatialIndex<
	PlaceGeospatialKey,
	PlaceFilterKeys
>(components.geospatial);

export const syncPlaceIndex = internalMutation({
	args: { placeId: v.id("places") },
	returns: v.null(),
	handler: async (ctx, { placeId }) => {
		await syncPlaceToGeospatial(ctx, placeId);
		return null;
	},
});

export const removePlaceIndex = internalMutation({
	args: { placeId: v.id("places") },
	returns: v.null(),
	handler: async (ctx, { placeId }) => {
		await removePlaceFromGeospatial(ctx, placeId);
		return null;
	},
});

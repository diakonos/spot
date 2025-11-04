import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";

const BATCH_SIZE = 500;

export const listAllSavedPlaces = internalQuery({
	args: {},
	handler: async (ctx) => {
		const saves = await ctx.db.query("saved_places").collect();
		return saves.map((s) => ({ placeId: s.placeId }));
	},
});

export const getPlaceById = internalQuery({
	args: { placeId: v.id("places") },
	handler: async (ctx, { placeId }) => {
		const place = await ctx.db.get(placeId);
		if (!place) {
			return null;
		}
		return { providerPlaceId: place.providerPlaceId };
	},
});

export const syncSavedPlaces = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		// Sync ONLY places that are actually saved by someone
		const saves = await ctx.runQuery(internal.schedule.listAllSavedPlaces, {});
		const uniquePlaceIds = Array.from(
			new Set(saves.map((s: { placeId: any }) => s.placeId))
		);

		// Throttle/batch if large
		const batch = uniquePlaceIds.slice(0, BATCH_SIZE);
		for (const placeId of batch) {
			const placeData = await ctx.runQuery(internal.schedule.getPlaceById, {
				placeId,
			});
			if (!placeData) {
				continue;
			}
			await ctx.runAction(api.places.upsertPlaceFromGoogle, {
				providerPlaceId: placeData.providerPlaceId,
			});
		}
		return null;
	},
});

const crons = cronJobs();

// Run nightly sync at 4am UTC
// crons.cron(
// 	"nightlySyncSavedPlaces",
// 	"0 4 * * *", // 4am UTC
// 	internal.schedule.syncSavedPlaces,
// 	{}
// );

export default crons;

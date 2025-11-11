import { captureException, startSpan } from "@sentry/tanstackstart-react";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { placesGeospatialIndex } from "../geospatial";

export async function syncPlaceToGeospatial(
	ctx: MutationCtx,
	placeId: Id<"places">
) {
	await startSpan({ name: "geospatial.syncPlace" }, async () => {
		const place = await ctx.db.get(placeId);
		if (!place) {
			await removePlaceFromGeospatial(ctx, placeId);
			return;
		}

		const location = place.location;
		if (!location) {
			await removePlaceFromGeospatial(ctx, placeId);
			return;
		}

		if (await placesGeospatialIndex.get(ctx, placeId)) {
			// Prevent duplicates
			await placesGeospatialIndex.remove(ctx, placeId);
		}

		await placesGeospatialIndex.insert(
			ctx,
			placeId,
			{
				latitude: location.lat,
				longitude: location.lng,
			},
			{
				provider: place.provider,
				primaryType: place.primaryType ?? undefined,
			},
			place.rating ?? undefined
		);
	});
}

export async function removePlaceFromGeospatial(
	ctx: MutationCtx,
	placeId: Id<"places">
) {
	await startSpan({ name: "geospatial.removePlace" }, async () => {
		try {
			await placesGeospatialIndex.remove(ctx, placeId);
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return;
			}
			captureException(error, {
				tags: { component: "geospatial" },
				contexts: { geospatial: { placeId } },
			});
		}
	});
}

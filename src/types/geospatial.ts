import type { Doc, Id } from "../../convex/_generated/dataModel";

export type PlaceGeospatialKey = Id<"places">;

export type PlaceFilterKeys = {
	provider: Doc<"places">["provider"];
	primaryType?: Doc<"places">["primaryType"];
};

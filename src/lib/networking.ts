import { ConvexError } from "convex/values";

/* BASIC TIME CONSTANTS */
export const SEC_PER_MIN = 60;
export const MS_PER_SEC = 1000;
export const MINUTES_TO_MS = SEC_PER_MIN * MS_PER_SEC;

/* QUERY STALE TIME */
export const QUERY_STALE_TIME_MINUTES = 5;
export const QUERY_STALE_TIME_MS = QUERY_STALE_TIME_MINUTES * MINUTES_TO_MS;

export type ConvexErrorData = {
	code: number;
	message: string;
};

export function createConvexError(
	code: number,
	message: string
): ConvexError<ConvexErrorData> {
	return new ConvexError({ code, message });
}

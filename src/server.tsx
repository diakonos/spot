// biome-ignore lint/performance/noNamespaceImport: Implemented according to documentation
import * as Sentry from "@sentry/tanstackstart-react";
import {
	createStartHandler,
	defaultStreamHandler,
	defineHandlerCallback,
} from "@tanstack/react-start/server";
import type { ServerEntry } from "@tanstack/react-start/server-entry";

if (!process.env.SENTRY_DSN) {
	throw new Error("Missing SENTRY_DSN environment variable");
}

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	sendDefaultPii: true,
});

const customHandler = defineHandlerCallback((ctx) => {
	// add custom logic here
	return Sentry.wrapStreamHandlerWithSentry(defaultStreamHandler)(ctx);
});

const fetch = createStartHandler(customHandler);

export default {
	fetch,
} satisfies ServerEntry;

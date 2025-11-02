// biome-ignore lint/performance/noNamespaceImport: Implemented according to documentation
import * as Sentry from "@sentry/tanstackstart-react";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

if (!import.meta.env.VITE_SENTRY_DSN) {
	throw new Error("Missing VITE_SENTRY_DSN environment variable");
}

Sentry.init({
	dsn: import.meta.env.VITE_SENTRY_DSN,
	sendDefaultPii: true,
});

hydrateRoot(
	document,
	<StrictMode>
		<StartClient />
	</StrictMode>
);

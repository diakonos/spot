// biome-ignore lint/performance/noNamespaceImport: Implemented according to documentation
import * as Sentry from "@sentry/tanstackstart-react";
import { createMiddleware, createStart } from "@tanstack/react-start";
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";

const sentryMiddleware = createMiddleware().server(
	Sentry.sentryGlobalServerMiddlewareHandler()
);

export const startInstance = createStart(() => ({
	requestMiddleware: [sentryMiddleware, authkitMiddleware()],
}));

// biome-ignore lint/performance/noNamespaceImport: Implemented according to documentation
import * as Sentry from "@sentry/tanstackstart-react";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { LayoutGroup } from "framer-motion";
import { MapViewStateProvider } from "@/context/MapViewContext";
import appCss from "../styles.css?url";

const Devtools =
	process.env.NODE_ENV === "development"
		? (await import("@/components/Devtools")).default
		: () => null;

export const Route = Sentry.wrapCreateRootRouteWithSentry(createRootRoute)({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "TanStack Start Starter",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<MapViewStateProvider>
					<LayoutGroup>{children}</LayoutGroup>
				</MapViewStateProvider>
				<Devtools />
				<Scripts />
			</body>
		</html>
	);
}

// biome-ignore lint/performance/noNamespaceImport: Implemented according to documentation
import * as Sentry from "@sentry/tanstackstart-react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
	createRootRoute,
	HeadContent,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { LayoutGroup } from "framer-motion";
import ConvexProvider from "../integrations/convex/provider";
import WorkOSProvider from "../integrations/workos/provider";
import { QUERY_STALE_TIME_MS } from "../lib/networking";
import appCss from "../styles.css?url";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: QUERY_STALE_TIME_MS,
		},
	},
});

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
	const { location } = useRouterState({
		select: (s) => ({ location: s.location }),
	});
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					<ConvexProvider>
						<WorkOSProvider>
							<LayoutGroup>
								<div key={location.pathname}>{children}</div>
							</LayoutGroup>
							<TanStackDevtools
								config={{
									position: "bottom-right",
								}}
								plugins={[
									{
										name: "Tanstack Router",
										render: <TanStackRouterDevtoolsPanel />,
									},
									{
										name: "React Query",
										render: <ReactQueryDevtoolsPanel />,
									},
								]}
							/>
						</WorkOSProvider>
					</ConvexProvider>
				</QueryClientProvider>
				<Scripts />
			</body>
		</html>
	);
}

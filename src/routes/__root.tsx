import { ConvexQueryClient } from "@convex-dev/react-query";
// biome-ignore lint/performance/noNamespaceImport: Implemented according to documentation
import * as Sentry from "@sentry/tanstackstart-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import {
	AuthKitProvider,
	useAccessToken,
	useAuth,
} from "@workos/authkit-tanstack-react-start/client";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { LayoutGroup } from "framer-motion";
import { useCallback, useMemo } from "react";
import { MapViewStateProvider } from "@/context/MapViewContext";
import appCss from "../styles.css?url";

const Devtools =
	process.env.NODE_ENV === "development"
		? (await import("@/components/Devtools")).default
		: () => null;

function useAuthFromWorkOS() {
	const { loading, user } = useAuth();
	const { accessToken, getAccessToken } = useAccessToken();

	const fetchAccessToken = useCallback(
		async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
			if (!accessToken || forceRefreshToken) {
				return (await getAccessToken()) ?? null;
			}

			return accessToken;
		},
		[accessToken, getAccessToken]
	);

	return useMemo(
		() => ({
			isLoading: loading,
			isAuthenticated: !!user,
			fetchAccessToken,
		}),
		[loading, user, fetchAccessToken]
	);
}

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
	const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
	if (!CONVEX_URL) {
		throw new Error("Missing CONVEX_URL in environment variables");
	}
	const convex = new ConvexReactClient(CONVEX_URL);
	const convexQueryClient = new ConvexQueryClient(convex);

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
				gcTime: 5000,
			},
		},
	});
	convexQueryClient.connect(queryClient);
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<AuthKitProvider>
					<ConvexProviderWithAuth
						client={convexQueryClient.convexClient}
						useAuth={useAuthFromWorkOS}
					>
						<QueryClientProvider client={queryClient}>
							<MapViewStateProvider>
								<LayoutGroup>{children}</LayoutGroup>
							</MapViewStateProvider>
						</QueryClientProvider>
					</ConvexProviderWithAuth>
				</AuthKitProvider>
				<Devtools />
				<Scripts />
			</body>
		</html>
	);
}

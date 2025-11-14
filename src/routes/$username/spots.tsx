import {
	createFileRoute,
	Link,
	useCanGoBack,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { usePaginatedQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";
import { useMapViewState } from "@/context/MapViewContext";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/$username/spots")({
	component: RouteComponent,
});

function RouteComponent() {
	const { username } = Route.useParams();
	const { user } = useAuth();
	const { profile, isLoading: profileLoading } = useCurrentProfile();
	const isOwner = !!profile?.username && profile.username === username;

	const navigate = useNavigate();
	const router = useRouter();
	const canGoBack = useCanGoBack();

	const backLink = "/$username";
	const backLinkParams = { username };

	const {
		results: savedPlaces,
		status,
		loadMore,
	} = usePaginatedQuery(
		api.places.listSavedPlacesForCurrentUser,
		user && isOwner ? {} : ("skip" as const),
		{ initialNumItems: 10 }
	);
	const { setHighlight } = useMapViewState();
	const initialLoading = isOwner && savedPlaces === undefined;
	const showLoadMore =
		!!savedPlaces &&
		savedPlaces.length > 0 &&
		(status === "CanLoadMore" || status === "LoadingMore");
	const loadingMore = status === "LoadingMore";

	if (!isOwner) {
		return (
			<PageContainer>
				<PageNav
					backLink={backLink}
					backLinkParams={backLinkParams}
					title="Saved spots"
				/>
				<div className="px-6 py-20 text-center">
					<p className="font-semibold text-2xl">Spots are private</p>
					<p className="mt-2 text-muted-foreground">
						{profileLoading
							? "Checking permissions…"
							: "Only the owner can view their saved spots."}
					</p>
					<button
						className="mt-6 rounded-full border border-white/30 px-4 py-2 text-sm"
						onClick={() => navigate({ to: backLink, params: backLinkParams })}
						type="button"
					>
						Back to profile
					</button>
				</div>
			</PageContainer>
		);
	}

	return (
		<motion.div
			className="h-screen w-full bg-primary text-white"
			layoutId="my-spots"
		>
			<div className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3 backdrop-blur-sm">
				<button
					aria-label="Go back"
					className="flex items-center justify-center rounded-full p-2 text-white transition-colors hover:bg-blue-600"
					onClick={() =>
						canGoBack
							? router.history.back()
							: navigate({ to: backLink, params: backLinkParams })
					}
					type="button"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<p className="font-semibold text-lg text-white">My Spots</p>
			</div>

			<div className="px-4 py-6">
				{initialLoading && (
					<div className="py-8 text-center text-white/80">
						Loading your spots...
					</div>
				)}

				{savedPlaces !== undefined && savedPlaces.length === 0 && (
					<div className="py-8 text-center text-white/80">
						<p className="mb-2 font-semibold text-lg">No saved spots yet</p>
						<p className="text-sm">
							Start exploring and save your favorite places!
						</p>
					</div>
				)}

				{savedPlaces !== undefined && savedPlaces.length > 0 && (
					<ul className="space-y-3">
						{savedPlaces.map(({ save, place }) => {
							if (!place) {
								return null;
							}

							return (
								<li key={save._id}>
									<Link
										onClick={() => {
											setHighlight({
												providerPlaceId: place.providerPlaceId,
												placeId: place._id,
												name: place.name,
											});
										}}
										params={{ placeid: place.providerPlaceId }}
										to="/app/place/$placeid"
									>
										<motion.div
											className="cursor-pointer rounded-lg border border-white/20 bg-white/10 p-4 text-left backdrop-blur-sm transition-all hover:bg-white/20"
											whileHover={{ scale: 1.02 }}
											whileTap={{ scale: 0.98 }}
										>
											<div className="font-semibold text-lg text-white">
												{place.name}
											</div>
											{place.formattedAddress && (
												<div className="mt-2 flex items-start gap-2 text-white/80">
													<MapPin className="mt-0.5 h-4 w-4 shrink-0" />
													<span className="text-sm">
														{place.formattedAddress}
													</span>
												</div>
											)}
											{place.rating !== undefined && (
												<div className="mt-2 flex items-center gap-2">
													<span className="font-semibold text-white">
														{place.rating.toFixed(1)}
													</span>
													<span className="text-white/80">⭐</span>
												</div>
											)}
										</motion.div>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
				{showLoadMore && (
					<div className="mt-6 text-center">
						<button
							className="rounded-full border border-white/30 px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={status !== "CanLoadMore"}
							onClick={() => {
								loadMore(10);
							}}
							type="button"
						>
							{loadingMore ? "Loading more..." : "Load more"}
						</button>
					</div>
				)}
			</div>
		</motion.div>
	);
}

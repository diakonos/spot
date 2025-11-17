import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { usePaginatedQuery } from "convex/react";
import { MapPin } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";
import { Skeleton } from "@/components/ui/skeleton";
import { useMapViewState } from "@/context/MapViewContext";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { cardClassNames } from "@/lib/ui";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/$username/spots")({
	component: RouteComponent,
});

function RouteComponent() {
	const { username } = Route.useParams();
	const { user } = useAuth();
	const { profile, isLoading: profileLoading } = useCurrentProfile();
	const navigate = useNavigate();

	const isOwner = !!profile?.username && profile.username === username;
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
	const initialLoading = status === "LoadingFirstPage";
	const showLoadMore =
		!!savedPlaces &&
		savedPlaces.length > 0 &&
		(status === "CanLoadMore" || status === "LoadingMore");
	const loadingMore = status === "LoadingMore";

	if (!(isOwner || profileLoading)) {
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
		<PageContainer>
			<PageNav title={isOwner ? "My Spots" : `${username}'s Spots`} />

			<div className="px-4">
				{initialLoading && (
					<div className="mx-auto max-w-xl space-y-3">
						<Skeleton className="h-30 w-full" />
						<Skeleton className="h-30 w-full" />
						<Skeleton className="h-30 w-full" />
					</div>
				)}

				{!initialLoading &&
					savedPlaces !== undefined &&
					savedPlaces.length === 0 && (
						<div className="py-8 text-center">
							<p className="mb-2 font-semibold text-lg">No saved spots yet</p>
							<p className="text-sm">
								Start exploring and save your favorite places!
							</p>
						</div>
					)}

				{savedPlaces !== undefined && savedPlaces.length > 0 && (
					<ul className="mx-auto max-w-xl space-y-3">
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
										<div
											className={cardClassNames("cursor-pointer p-4 text-left")}
										>
											<div className="font-semibold text-lg">{place.name}</div>
											{place.formattedAddress && (
												<div className="mt-2 flex items-start gap-2">
													<MapPin className="mt-0.5 h-4 w-4 shrink-0" />
													<span className="text-sm">
														{place.formattedAddress}
													</span>
												</div>
											)}
										</div>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
				{showLoadMore && (
					<div className="mt-6 text-center">
						<button
							className="rounded-full border border-white/30 px-4 py-2 font-semibold text-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
		</PageContainer>
	);
}

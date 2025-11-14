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
import { useMapViewState } from "@/context/MapViewContext";
import { api } from "../../../../convex/_generated/api";

export const Route = createFileRoute("/app/profile/spots")({
	component: RouteComponent,
});

function RouteComponent() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const router = useRouter();
	const canGoBack = useCanGoBack();
	const {
		results: savedPlaces,
		status,
		loadMore,
	} = usePaginatedQuery(
		api.places.listSavedPlacesForCurrentUser,
		user ? {} : "skip",
		{ initialNumItems: 10 }
	)
	const { setHighlight } = useMapViewState();
	const initialLoading = savedPlaces === undefined;
	const showLoadMore =
		savedPlaces !== undefined &&
		savedPlaces.length > 0 &&
		(status === "CanLoadMore" || status === "LoadingMore");
	const loadingMore = status === "LoadingMore";

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
						canGoBack ? router.history.back() : navigate({ to: "/app" })
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
								return null
							}

							return (
								<li key={save._id}>
									<Link
										onClick={() => {
											setHighlight({
												providerPlaceId: place.providerPlaceId,
												placeId: place._id,
												name: place.name,
											})
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
							)
						})}
					</ul>
				)}
				{showLoadMore && (
					<div className="mt-6 text-center">
						<button
							className="rounded-full border border-white/30 px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={status !== "CanLoadMore"}
							onClick={() => {
								loadMore(10)
							}}
							type="button"
						>
							{loadingMore ? "Loading more..." : "Load more"}
						</button>
					</div>
				)}
			</div>
		</motion.div>
	)
}

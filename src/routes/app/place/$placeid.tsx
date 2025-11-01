import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Globe, MapPin, Phone } from "lucide-react";
import { getPlaceDetails } from "../../../integrations/google/client";
import { QUERY_STALE_TIME_MS } from "../../../lib/networking";

export const Route = createFileRoute("/app/place/$placeid")({
	component: PlaceDetailsComponent,
});

function PlaceDetailsComponent() {
	const navigate = useNavigate();
	const { placeid } = Route.useParams();

	const {
		data: placeDetails,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["places", "details", placeid],
		queryFn: async () => {
			const res = await getPlaceDetails(placeid);
			return res;
		},
		staleTime: QUERY_STALE_TIME_MS,
	});

	return (
		<div className="h-screen w-full overflow-y-auto">
			<div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
				<button
					aria-label="Go back"
					className="flex items-center justify-center rounded-full p-2 transition-colors hover:bg-muted"
					onClick={() => navigate({ to: "/app/search" })}
					type="button"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<h1 className="font-semibold text-lg">Place Details</h1>
			</div>

			<div className="px-4 py-6">
				{isLoading && (
					<div className="py-8 text-center text-muted-foreground">
						Loading place details…
					</div>
				)}

				{error && (
					<div className="py-8 text-center text-red-500">
						{error instanceof Error
							? error.message
							: "Failed to load place details"}
					</div>
				)}

				{placeDetails && (
					<div className="space-y-6">
						{/* Name */}
						<div>
							<h2 className="font-bold text-2xl">{placeDetails.name}</h2>
							{placeDetails.formatted_address && (
								<div className="mt-2 flex items-start gap-2 text-muted-foreground">
									<MapPin className="mt-0.5 h-4 w-4 shrink-0" />
									<span className="text-sm">
										{placeDetails.formatted_address}
									</span>
								</div>
							)}
						</div>

						{/* Rating */}
						{placeDetails.rating !== undefined && (
							<div className="flex items-center gap-2">
								<span className="font-semibold text-lg">
									{placeDetails.rating.toFixed(1)}
								</span>
								<span className="text-muted-foreground">⭐</span>
								{placeDetails.user_ratings_total !== undefined && (
									<span className="text-muted-foreground text-sm">
										({placeDetails.user_ratings_total.toLocaleString()} reviews)
									</span>
								)}
							</div>
						)}

						{/* Open Now */}
						{placeDetails.open_now !== undefined && (
							<div
								className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium text-sm ${
									placeDetails.open_now
										? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
										: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
								}`}
							>
								<span
									className={`h-2 w-2 rounded-full ${
										placeDetails.open_now ? "bg-green-600" : "bg-red-600"
									}`}
								/>
								{placeDetails.open_now ? "Open Now" : "Closed"}
							</div>
						)}

						{/* Contact Information */}
						{(placeDetails.phone || placeDetails.website) && (
							<div className="space-y-3">
								{placeDetails.phone && (
									<a
										className="flex items-center gap-3 text-primary hover:underline"
										href={`tel:${placeDetails.phone}`}
									>
										<Phone className="h-5 w-5" />
										<span>{placeDetails.phone}</span>
									</a>
								)}
								{placeDetails.website && (
									<a
										className="flex items-center gap-3 text-primary hover:underline"
										href={placeDetails.website}
										rel="noopener noreferrer"
										target="_blank"
									>
										<Globe className="h-5 w-5" />
										<span className="truncate">{placeDetails.website}</span>
										<ExternalLink className="h-4 w-4 shrink-0" />
									</a>
								)}
							</div>
						)}

						{/* Google Maps Link */}
						{placeDetails.google_maps_uri && (
							<a
								className="flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-3 transition-colors hover:bg-muted"
								href={placeDetails.google_maps_uri}
								rel="noopener noreferrer"
								target="_blank"
							>
								<MapPin className="h-5 w-5" />
								<span>Open in Google Maps</span>
								<ExternalLink className="h-4 w-4" />
							</a>
						)}

						{/* Photos */}
						{placeDetails.photos && placeDetails.photos.length > 0 && (
							<div className="space-y-2">
								<h3 className="font-semibold text-lg">Photos</h3>
								<div className="text-muted-foreground text-sm">
									{placeDetails.photos.length} photo
									{placeDetails.photos.length !== 1 ? "s" : ""} available
								</div>
								<div className="text-muted-foreground text-xs">
									Photo name: {placeDetails.photos[0]?.name}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

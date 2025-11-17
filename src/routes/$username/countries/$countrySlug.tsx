import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import { MailIcon, MapPin, Sparkles } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { cardClassNames } from "@/lib/ui";
import { getCountryFlagEmoji } from "@/lib/utils";
import type { Place } from "@/serverFns/createItinerary";
import { createItinerary } from "@/serverFns/createItinerary";
import { emailItinerary } from "@/serverFns/emailItinerary";
import { api } from "../../../../convex/_generated/api";

export const Route = createFileRoute("/$username/countries/$countrySlug")({
	component: CountryPlacesRoute,
});

function CountryPlacesRoute() {
	const { username, countrySlug } = Route.useParams();
	const { profile } = useCurrentProfile();
	const [itinerary, setItinerary] = useState<string | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isEmailing, setIsEmailing] = useState(false);
	const [generateError, setGenerateError] = useState<string | null>(null);
	const [emailError, setEmailError] = useState<string | null>(null);
	const [emailSuccess, setEmailSuccess] = useState(false);

	const countries = useConvexQuery(
		api.places.listSavedCountriesForUser,
		username ? { username } : "skip"
	);

	const places = useConvexQuery(
		api.places.listSavedPlacesByCountry,
		username && countrySlug ? { username, countrySlug } : "skip"
	);

	// Get country name and code from countries list by matching slug
	const countryData = countries?.find((c) => c.slug === countrySlug);
	const countryName =
		countryData?.countryName ||
		(places && places.length > 0
			? places[0]?.formattedAddress?.split(",").pop()?.trim() || countrySlug
			: countrySlug);
	const countryCode = countryData?.countryCode;

	const backLink = "/$username";
	const backLinkParams = { username };

	const handleCreateItinerary = async () => {
		if (!places || places.length < 3) {
			return;
		}

		setIsGenerating(true);
		setGenerateError(null);
		setItinerary(null);

		try {
			const placesData: Place[] = places.map((place) => ({
				name: place.name,
				primaryType: place.primaryType,
				formattedAddress: place.formattedAddress,
				location: place.location,
			}));

			const result = await createItinerary({
				data: {
					countryName,
					places: placesData,
				},
			});

			setItinerary(result.itinerary);
		} catch (error) {
			setGenerateError(
				error instanceof Error ? error.message : "Failed to generate itinerary"
			);
		} finally {
			setIsGenerating(false);
		}
	};

	const handleEmailItinerary = async () => {
		if (!(itinerary && profile?.email)) {
			return;
		}

		setIsEmailing(true);
		setEmailError(null);
		setEmailSuccess(false);

		try {
			await emailItinerary({
				data: {
					email: profile.email,
					countryName,
					itinerary,
				},
			});

			setEmailSuccess(true);
		} catch (error) {
			setEmailError(
				error instanceof Error ? error.message : "Failed to send email"
			);
		} finally {
			setIsEmailing(false);
		}
	};

	let emailButtonText = "Email itinerary";
	if (isEmailing) {
		emailButtonText = "Sending...";
	} else if (emailSuccess) {
		emailButtonText = "Email sent!";
	}

	return (
		<PageContainer>
			<PageNav
				title={
					countryCode ? (
						<span className="flex items-center gap-2">
							<span>{getCountryFlagEmoji(countryCode)}</span>
							<span>{countryName}</span>
						</span>
					) : (
						countryName
					)
				}
			/>

			<div className="px-4">
				{places === undefined ? (
					<div className="mx-auto max-w-xl space-y-3">
						<Skeleton className="h-30 w-full" />
						<Skeleton className="h-30 w-full" />
						<Skeleton className="h-30 w-full" />
					</div>
				) : null}
				{places === null || places?.length === 0 ? (
					<div className="py-8 text-center">
						<p className="mb-2 font-semibold text-lg">No places found</p>
						<p className="text-muted-foreground text-sm">
							This country doesn't have any saved places yet.
						</p>
						<Link
							className="mt-4 inline-block rounded-full border border-white/30 px-4 py-2 text-sm"
							params={backLinkParams}
							to={backLink}
						>
							Back to profile
						</Link>
					</div>
				) : null}
				{places !== undefined && places !== null && places.length > 0 ? (
					<>
						<div className="mb-4 text-center">
							<p className="text-muted-foreground text-sm">
								{places.length} {places.length === 1 ? "place" : "places"} saved
							</p>
						</div>

						{!itinerary && (
							<div className="mb-6 flex flex-col items-center gap-3">
								{places.length < 3 && (
									<p className="text-muted-foreground text-sm">
										Add at least 3 places to create an itinerary!
									</p>
								)}
								<Button
									disabled={isGenerating || places.length < 3}
									onClick={handleCreateItinerary}
									variant="primary"
								>
									<Sparkles className="mr-2 h-4 w-4" />
									{isGenerating
										? "Generating itinerary..."
										: "Create itinerary"}
								</Button>
							</div>
						)}

						{generateError && (
							<div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-500 text-sm">
								{generateError}
							</div>
						)}

						{itinerary && (
							<div className="mb-6 space-y-4">
								<div className={cardClassNames("p-6")}>
									<div className="mb-4 flex items-center justify-between">
										<h2 className="font-semibold text-xl">
											Generated Itinerary
										</h2>
										{profile?.email && (
											<Button
												className="px-3 py-2 text-sm"
												disabled={isEmailing || emailSuccess}
												onClick={handleEmailItinerary}
												variant="secondary"
											>
												<MailIcon className="mr-2 h-4 w-4" />
												{emailButtonText}
											</Button>
										)}
									</div>
									{emailError && (
										<div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-red-500 text-sm">
											{emailError}
										</div>
									)}
									{emailSuccess && (
										<div className="mb-4 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-green-500 text-sm">
											Itinerary sent to {profile?.email}!
										</div>
									)}
									<div className="prose prose-sm dark:prose-invert max-w-none">
										<Markdown
											components={{
												p: ({ children }) => (
													<p className="mb-2 text-sm">{children}</p>
												),
												hr: () => <hr className="my-4" />,
												h1: ({ children }) => (
													<h1 className="mb-4 font-bold text-4xl">
														{children}
													</h1>
												),
												h2: ({ children }) => (
													<h2 className="mb-4 font-bold text-3xl">
														{children}
													</h2>
												),
												h3: ({ children }) => (
													<h3 className="mb-2 font-bold text-2xl">
														{children}
													</h3>
												),
												h4: ({ children }) => (
													<h4 className="mb-2 font-bold text-xl">{children}</h4>
												),
												h5: ({ children }) => (
													<h5 className="mb-2 font-bold text-lg">{children}</h5>
												),
												h6: ({ children }) => (
													<h6 className="mb-2">{children}</h6>
												),
												li: ({ children }) => (
													<li className="mb-2">{children}</li>
												),
											}}
										>
											{itinerary}
										</Markdown>
									</div>
								</div>
							</div>
						)}

						<ul className="mx-auto max-w-xl space-y-3 pb-4">
							{places.map((place) => (
								<li key={place._id}>
									<Link
										params={{ placeid: place.providerPlaceId }}
										to="/app/place/$placeid"
									>
										<div
											className={cardClassNames(
												"cursor-pointer p-4 text-left transition-colors hover:bg-muted"
											)}
										>
											<div className="font-semibold text-lg">{place.name}</div>
											{place.primaryType && (
												<div className="mt-1 text-muted-foreground text-sm">
													{place.primaryType}
												</div>
											)}
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
							))}
						</ul>
					</>
				) : null}
			</div>
		</PageContainer>
	);
}

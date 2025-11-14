import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";
import { Skeleton } from "@/components/ui/skeleton";
import { cardClassNames } from "@/lib/ui";
import { api } from "../../../../convex/_generated/api";

export const Route = createFileRoute("/$username/lists/$slug")({
	component: ListDetailRoute,
});

function ListDetailRoute() {
	const navigate = useNavigate();
	const { slug, username } = Route.useParams();
	const listArgs = useMemo(
		() => (slug && username ? { slug, username } : "skip"),
		[slug, username]
	);
	const listData = useConvexQuery(api.lists.getListBySlugForProfile, listArgs);

	const isLoading = slug && username && listData === undefined;
	const backLink = username ? "/$username/lists" : "/";
	const backLinkParams = username ? { username } : undefined;

	if (listData === null && !isLoading) {
		return (
			<PageContainer>
				<PageNav
					backLink={backLink}
					backLinkParams={backLinkParams}
					title="List"
				/>
				<div className={cardClassNames("p-6 text-center")}>
					<p>List not found or private.</p>
					<Button className="mt-4" onClick={() => navigate({ to: backLink })}>
						Back to lists
					</Button>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageNav
				backLink={backLink}
				backLinkParams={backLinkParams}
				title={listData?.list.name ?? "List"}
			/>
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6">
				{isLoading && (
					<div className="space-y-4">
						<Skeleton className="h-25 w-full" />
						<Skeleton className="h-25 w-full" />
						<Skeleton className="h-25 w-full" />
					</div>
				)}

				{listData && listData.entries.length !== 0 ? (
					<ul className="grid gap-4 sm:grid-cols-2">
						{listData.entries.map((entry) => {
							if (!entry.place) {
								return null;
							}
							return (
								<li key={entry.entryId}>
									<Link
										params={{ placeid: entry.place.providerPlaceId }}
										to="/app/place/$placeid"
									>
										<motion.div className={cardClassNames("h-full")}>
											<h3 className="font-semibold text-lg">
												{entry.place.name}
											</h3>
											{entry.place.formattedAddress && (
												<p className="mt-2 flex items-start gap-2 text-sm">
													<MapPin className="mt-0.5 h-4 w-4 shrink-0" />
													<span>{entry.place.formattedAddress}</span>
												</p>
											)}
										</motion.div>
									</Link>
								</li>
							);
						})}
					</ul>
				) : null}

				{listData && listData.entries.length === 0 && (
					<div className="rounded-3xl border border-white/20 border-dashed bg-white/5 p-6 text-center">
						<p>No places saved yet.</p>
						{listData.viewerIsOwner ? (
							<p className="mt-2 text-sm">
								Head back to a spot, open it, and choose “Save to list.”
							</p>
						) : (
							<p className="mt-2 text-muted-foreground text-sm">
								Check back later for new additions.
							</p>
						)}
					</div>
				)}
			</div>
		</PageContainer>
	);
}

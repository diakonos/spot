import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Globe, Lock, MapPin, ShareIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystemShare } from "@/hooks/useSystemShare";
import { createLogger } from "@/lib/logger";
import { cardClassNames } from "@/lib/ui";
import { api } from "../../../../convex/_generated/api";

const logger = createLogger("ListDetailRoute");

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
	const updateVisibility = useMutation(api.lists.updateListVisibility);
	const shareList = useSystemShare();
	const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

	const isLoading = slug && username && listData === undefined;
	const backLink = username ? "/$username/lists" : "/";
	const backLinkParams = username ? { username } : undefined;
	const listTitle = listData?.list.name ?? "List";

	const handleShare = useCallback(async () => {
		if (typeof window === "undefined") {
			return;
		}

		const result = await shareList({
			url: window.location.href,
			title: listTitle,
			text: `Check out ${listTitle} on Spot.`,
		});

		if (!result.ok) {
			logger.error("Failed to share list", result.error);
		}
	}, [listTitle, shareList]);

	const handleToggleVisibility = useCallback(async () => {
		if (!listData?.viewerIsOwner || isUpdatingVisibility) {
			return;
		}

		const newVisibility =
			listData.list.visibility === "public" ? "private" : "public";
		setIsUpdatingVisibility(true);
		try {
			await updateVisibility({
				listId: listData.list._id,
				visibility: newVisibility,
			});
		} catch (err) {
			logger.error("Failed to update list visibility", err);
		} finally {
			setIsUpdatingVisibility(false);
		}
	}, [listData, updateVisibility, isUpdatingVisibility]);

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
				rightButton={
					listData ? (
						<div className="flex items-center gap-2">
							{listData.viewerIsOwner && (
								<Button
									className="hover:bg-slate-200"
									disabled={isUpdatingVisibility}
									onClick={handleToggleVisibility}
									variant="ghost"
								>
									{listData.list.visibility === "public" ? (
										<Globe className="size-4" />
									) : (
										<Lock className="size-4" />
									)}
									<span className="ml-1.5">
										{listData.list.visibility === "public"
											? "Public"
											: "Private"}
									</span>
								</Button>
							)}
							<Button
								className="hover:bg-slate-200"
								onClick={handleShare}
								variant="ghost"
							>
								<ShareIcon className="size-4" />
								Share
							</Button>
						</div>
					) : undefined
				}
				title={listData?.list.name ?? "List"}
			/>
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6">
				{isLoading && (
					<div className="mx-auto max-w-xl space-y-4">
						<Skeleton className="h-25 w-full" />
						<Skeleton className="h-25 w-full" />
						<Skeleton className="h-25 w-full" />
					</div>
				)}

				{listData && listData.entries.length !== 0 ? (
					<ul className="mx-auto grid max-w-xl gap-4">
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

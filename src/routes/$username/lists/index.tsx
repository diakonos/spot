import { createFileRoute, Link } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ListPlus, Loader2, Lock, Unlock } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cardClassNames } from "@/lib/ui";
import { api } from "../../../../convex/_generated/api";

const FALLBACK_SIGNIN_PATH = "/api/auth/login";

export const Route = createFileRoute("/$username/lists/")({
	loader: async () => {
		const [{ user }, signinLink] = await Promise.all([
			getAuth(),
			getSignInUrl(),
		]);
		return { isAuthenticated: !!user, signinLink };
	},
	component: ListsRoute,
});

function ListsRoute() {
	const { username } = Route.useParams();
	const { user } = useAuth();
	const { signinLink } = Route.useLoaderData();

	const [listName, setListName] = useState("");
	const [listDescription, setListDescription] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [showCreateListForm, setShowCreateListForm] = useState(false);

	const listsArgs = useMemo(
		() => (username ? { username } : "skip"),
		[username]
	);
	const listsData = useConvexQuery(api.lists.getListsForProfile, listsArgs);

	const createList = useMutation(api.lists.createList);
	const viewerIsOwner = listsData?.viewerIsOwner ?? false;
	const lists = listsData?.lists ?? [];
	const ownerName = buildOwnerName(listsData?.owner ?? null, username);

	const handleCreateList = async () => {
		const trimmedName = listName.trim();
		if (!trimmedName) {
			setError("Enter a list name");
			return;
		}
		setIsCreating(true);
		setError(null);
		try {
			await createList({
				name: trimmedName,
				description: listDescription.trim() || undefined,
			});
			setListName("");
			setListDescription("");
			setShowCreateListForm(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create list");
		} finally {
			setIsCreating(false);
		}
	};

	const isLoading = listsData === undefined;

	if (listsData === null) {
		return (
			<PageContainer>
				<PageNav backLink="/" title="Lists" />
				<div className="px-6 py-20 text-center">
					<p className="font-semibold text-2xl">Profile not found</p>
					<p className="mt-2 text-muted-foreground">
						Check the username and try again.
					</p>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageNav
				backLink="/$username"
				backLinkParams={{ username }}
				title={
					viewerIsOwner ? "Your lists" : `${ownerName ?? username}'s lists`
				}
			/>
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6">
				<div>
					{isLoading && (
						<div className="space-y-4">
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
						</div>
					)}
					{!isLoading && lists.length === 0 && (
						<p className="text-muted-foreground">
							{viewerIsOwner
								? "You haven't created any lists yet. Start with one below!"
								: "No public lists to show yet."}
						</p>
					)}
					<ul className="grid gap-4 sm:grid-cols-2">
						{lists.map((list) => (
							<li key={list._id}>
								<Link
									params={{ username, slug: list.slug }}
									to="/$username/lists/$slug"
								>
									<motion.div
										className={cardClassNames("h-full")}
										layoutId={list._id}
									>
										<div className="flex items-center justify-between gap-3">
											<h3 className="font-semibold text-xl">{list.name}</h3>
											{list.visibility === "private" ? (
												<span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs">
													<Lock className="h-3 w-3" /> Private
												</span>
											) : (
												<span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs">
													<Unlock className="h-3 w-3" /> Public
												</span>
											)}
										</div>
										{list.description && (
											<p className="mt-2 line-clamp-2 text-sm">
												{list.description}
											</p>
										)}
										<p className="mt-4 text-sm">
											{list.itemCount} place
											{list.itemCount === 1 ? "" : "s"}
										</p>
									</motion.div>
								</Link>
							</li>
						))}
					</ul>
				</div>
				{viewerIsOwner ? (
					<motion.div
						className={cardClassNames(
							`flex flex-col gap-4 ${showCreateListForm ? "p-6" : "p-0 hover:cursor-pointer"}`
						)}
					>
						<AnimatePresence>
							{showCreateListForm && (
								<div className="flex flex-col items-center justify-center space-y-3">
									<Input
										className="bg-black/20"
										disabled={isCreating}
										onChange={(e) => setListName(e.target.value)}
										placeholder="e.g. Favorite coffee shops"
										value={listName}
									/>
									<Input
										className="bg-black/20"
										disabled={isCreating}
										onChange={(e) => setListDescription(e.target.value)}
										placeholder="Optional description"
										value={listDescription}
									/>
									{error && <p className="text-red-400 text-sm">{error}</p>}
								</div>
							)}
						</AnimatePresence>
						<Button
							className={"transition-all hover:cursor-pointer"}
							onClick={() => {
								if (!user) {
									window.location.href = signinLink ?? FALLBACK_SIGNIN_PATH;
									return;
								}
								if (showCreateListForm) {
									handleCreateList();
								} else {
									setShowCreateListForm(true);
								}
							}}
							type="button"
						>
							{isCreating ? (
								<>
									<Loader2 className="mr-2 h-5 w-5 animate-spin" />
									Creating…
								</>
							) : (
								<>
									<ListPlus className="size-5" />
									Create a list
								</>
							)}
						</Button>
						<AnimatePresence>
							{showCreateListForm && (
								<Button
									onClick={() => setShowCreateListForm(false)}
									variant="destructive"
								>
									Cancel
								</Button>
							)}
						</AnimatePresence>
					</motion.div>
				) : null}
			</div>
		</PageContainer>
	);
}

function buildOwnerName(
	owner: { firstName?: string | null; lastName?: string | null } | null,
	username: string
) {
	if (!owner) {
		return username;
	}
	if (owner.firstName && owner.lastName) {
		return `${owner.firstName} ${owner.lastName}`.trim();
	}
	return owner.firstName ?? username;
}

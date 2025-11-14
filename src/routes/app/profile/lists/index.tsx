import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { ListPlus, Loader2, Lock, Unlock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/ui/input";
import { api } from "../../../../../convex/_generated/api";

const FALLBACK_SIGNIN_PATH = "/api/auth/login";

export const Route = createFileRoute("/app/profile/lists/")({
	loader: async () => {
		const [{ user }, signinLink] = await Promise.all([
			getAuth(),
			getSignInUrl(),
		]);

		if (!user) {
			throw redirect({
				href: signinLink ?? FALLBACK_SIGNIN_PATH,
			});
		}

		return { user };
	},
	component: ListsRoute,
});

function ListsRoute() {
	const navigate = useNavigate();
	const { user } = Route.useLoaderData();
	const [listName, setListName] = useState("");
	const [listDescription, setListDescription] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);

	const lists = useConvexQuery(
		api.lists.getListsForCurrentUser,
		user ? {} : "skip"
	);
	const createList = useMutation(api.lists.createList);

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
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create list");
		} finally {
			setIsCreating(false);
		}
	};

	const isLoading = lists === undefined;

	return (
		<div className="min-h-screen bg-slate-950 text-white">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
				<div className="flex items-center justify-between gap-4">
					<Button
						className="rounded-2xl py-3 text-lg"
						onClick={() => navigate({ to: "/app" })}
					>
						Back to map
					</Button>
				</div>

				<div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
					<h2 className="mb-4 flex items-center gap-2 font-semibold text-lg">
						<ListPlus className="size-5" />
						Create a list
					</h2>
					<div className="space-y-3">
						<Input
							className="bg-black/20 text-white"
							disabled={isCreating}
							onChange={(e) => setListName(e.target.value)}
							placeholder="e.g. Favorite coffee shops"
							value={listName}
						/>
						<Input
							className="bg-black/20 text-white"
							disabled={isCreating}
							onChange={(e) => setListDescription(e.target.value)}
							placeholder="Optional description"
							value={listDescription}
						/>
						{error && <p className="text-red-400 text-sm">{error}</p>}
						<Button
							className="w-full rounded-2xl py-3 text-lg"
							disabled={isCreating}
							onClick={handleCreateList}
						>
							{isCreating ? (
								<>
									<Loader2 className="mr-2 h-5 w-5 animate-spin" />
									Creating…
								</>
							) : (
								"Create list"
							)}
						</Button>
					</div>
				</div>

				<div className="space-y-4">
					<h2 className="text-white/80 text-xl">Your lists</h2>
					{isLoading && (
						<div className="flex items-center gap-2 text-white/60">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading lists…
						</div>
					)}
					{!isLoading && lists && lists.length === 0 && (
						<p className="text-white/60">
							You haven&apos;t created any lists yet. Start with one above!
						</p>
					)}
					<ul className="grid gap-4 sm:grid-cols-2">
						{lists?.map((list) => (
							<li key={list._id}>
								<Link params={{ slug: list.slug }} to="/app/lists/$slug">
									<motion.div
										className="h-full rounded-3xl border border-white/10 bg-white/10 p-5 shadow-lg backdrop-blur transition hover:bg-white/20"
										layoutId={list._id}
									>
										<div className="flex items-center justify-between gap-3">
											<h3 className="font-semibold text-xl">{list.name}</h3>
											{list.visibility === "private" ? (
												<span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-white/70 text-xs">
													<Lock className="h-3 w-3" /> Private
												</span>
											) : (
												<span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-white/70 text-xs">
													<Unlock className="h-3 w-3" /> Public
												</span>
											)}
										</div>
										{list.description && (
											<p className="mt-2 line-clamp-2 text-sm text-white/70">
												{list.description}
											</p>
										)}
										<p className="mt-4 text-sm text-white/80">
											{list.itemCount} place
											{list.itemCount === 1 ? "" : "s"}
										</p>
									</motion.div>
								</Link>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}

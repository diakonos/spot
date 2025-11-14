import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/Button";
import { api } from "../../../../convex/_generated/api";

export const Route = createFileRoute("/app/lists/$slug")({
	component: ListDetailRoute,
});

function ListDetailRoute() {
	const navigate = useNavigate();
	const { slug } = Route.useParams();
	const listArgs = useMemo(() => (slug ? { slug } : "skip"), [slug]);
	const listData = useConvexQuery(api.lists.getListBySlug, listArgs);

	const isLoading = slug && listData === undefined;

	return (
		<div className="min-h-screen bg-slate-950 text-white">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
				<div className="flex items-center justify-between gap-4">
					<button
						className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
						onClick={() => navigate({ to: "/app/lists" })}
						type="button"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to lists
					</button>
					<Button onClick={() => navigate({ to: "/app" })}>Back to map</Button>
				</div>

				{isLoading && (
					<div className="flex items-center gap-2 text-white/70">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading list…
					</div>
				)}

				{!isLoading && listData === null && (
					<div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
						<p>List not found.</p>
						<Button
							className="mt-4"
							onClick={() => navigate({ to: "/app/lists" })}
						>
							View my lists
						</Button>
					</div>
				)}

				{listData && (
					<>
						<div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
							<p className="text-sm text-white/60 uppercase tracking-wide">
								List
							</p>
							<h1 className="mt-2 font-semibold text-4xl">
								{listData.list.name}
							</h1>
							{listData.list.description && (
								<p className="mt-3 text-base text-white/80">
									{listData.list.description}
								</p>
							)}
							<p className="mt-4 text-sm text-white/60">
								{listData.entries.length} saved place
								{listData.entries.length === 1 ? "" : "s"}
							</p>
						</div>

						{listData.entries.length === 0 ? (
							<div className="rounded-3xl border border-white/20 border-dashed bg-white/5 p-6 text-center text-white/70">
								<p>No places saved yet.</p>
								<p className="mt-2 text-sm">
									Head back to a spot, open it, and choose &ldquo;Save to
									list.&rdquo;
								</p>
							</div>
						) : (
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
												<motion.div className="h-full rounded-3xl border border-white/10 bg-white/10 p-5 shadow-lg backdrop-blur transition hover:bg-white/20">
													<h3 className="font-semibold text-lg">
														{entry.place.name}
													</h3>
													{entry.place.formattedAddress && (
														<p className="mt-2 flex items-start gap-2 text-sm text-white/70">
															<MapPin className="mt-0.5 h-4 w-4 shrink-0" />
															<span>{entry.place.formattedAddress}</span>
														</p>
													)}
													{entry.place.rating !== undefined && (
														<p className="mt-3 text-sm text-white/80">
															Rating {entry.place.rating.toFixed(1)} ⭐
														</p>
													)}
												</motion.div>
											</Link>
										</li>
									);
								})}
							</ul>
						)}
					</>
				)}
			</div>
		</div>
	);
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
	getSignInUrl,
	getSignUpUrl,
} from "@workos/authkit-tanstack-react-start";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { Bookmark, Share2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
	component: App,
	loader: async () => ({
		signinLink: await getSignInUrl(),
		signupLink: await getSignUpUrl(),
	}),
});

function App() {
	const { user, loading, signOut } = useAuth();
	const isAuthenticated = Boolean(user);
	const greeting = user?.firstName || user?.email?.split("@")[0] || "traveler";
	const { signinLink, signupLink } = Route.useLoaderData();

	const features = [
		{
			title: "Save every spark",
			description:
				"Never lose track of cool places you see online. Clip, categorize, and add your own notes in seconds.",
			icon: Bookmark,
		},
		{
			title: "Share effortlessly",
			description:
				"Easily share your favorite spots from your latest vacation with friends, family, or your future self.",
			icon: Share2,
		},
		{
			title: "Plan in seconds",
			description:
				"Create travel itineraries in seconds based on the places you or your friends have already saved.",
			icon: Sparkles,
		},
	];

	const previewSpots = [
		{ city: "Lisbon", name: "Solar dos Presuntos", type: "Seafood dinner" },
		{ city: "Mexico City", name: "Cicatriz Café", type: "Slow morning" },
		{ city: "Tokyo", name: "Daikanyama T-Site", type: "Bookstore stroll" },
		{ city: "Barcelona", name: "Paradiso", type: "Hidden cocktail bar" },
	];

	return (
		<div className="min-h-screen bg-linear-to-b from-white via-slate-50 to-slate-100 text-slate-900">
			<div className="relative isolate overflow-hidden">
				<div
					aria-hidden="true"
					className="-translate-x-1/2 pointer-events-none absolute top-[-180px] left-1/2 h-[420px] w-[420px] rounded-full bg-cyan-200/40 blur-3xl motion-safe:animate-[pulse_10s_ease-in-out_infinite]"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-violet-100/70 via-white/0 to-transparent opacity-80"
				/>

				<div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
					<header className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-white/60 bg-white/80 px-6 py-4 shadow-sm ring-1 ring-black/5 backdrop-blur md:flex-row">
						<Link className="flex items-center gap-3" to="/">
							<div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-cyan-500 to-blue-500 text-white shadow-md">
								<span className="font-semibold text-lg">S</span>
								<span className="-right-2 -top-2 absolute rounded-full bg-amber-300 px-2 py-0.5 font-medium text-amber-900 text-xs shadow">
									Beta
								</span>
							</div>
							<div>
								<p className="font-semibold text-slate-400 text-sm uppercase tracking-[0.5em]">
									Spotted
								</p>
								<p className="font-semibold text-lg text-slate-900">
									Trips reimagined
								</p>
							</div>
						</Link>

						<div className="flex flex-wrap items-center gap-3">
							{isAuthenticated ? (
								<>
									<span className="text-slate-500 text-sm">Hi, {greeting}</span>
									<Link
										className="rounded-full bg-slate-900 px-5 py-2 font-semibold text-sm text-white transition hover:bg-slate-800"
										to="/app"
									>
										Open app
									</Link>
									<button
										className="rounded-full border border-slate-200 px-5 py-2 font-medium text-slate-600 text-sm transition hover:bg-slate-100"
										disabled={loading}
										onClick={() => signOut({ returnTo: "/" })}
										type="button"
									>
										{loading ? "Signing out..." : "Sign out"}
									</button>
								</>
							) : (
								<>
									<a
										className="font-semibold text-slate-500 text-sm transition hover:text-slate-800"
										href={signinLink}
									>
										Sign in
									</a>
									<a
										className="rounded-full bg-slate-900 px-5 py-2 font-semibold text-sm text-white transition hover:bg-slate-800"
										href={signupLink}
									>
										Get early access
									</a>
								</>
							)}
						</div>
					</header>

					<main className="mt-16 space-y-20 lg:mt-20">
						<section className="grid gap-12 lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
							<div className="space-y-8">
								<div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-1 font-semibold text-slate-500 text-xs uppercase tracking-[0.35em]">
									<span className="h-2 w-2 rounded-full bg-cyan-500" />
									Fresh finds daily
								</div>
								<div className="space-y-6">
									<h1 className="font-semibold text-4xl text-slate-900 tracking-tight sm:text-5xl lg:text-6xl">
										Plan unforgettable journeys with{" "}
										<span className="bg-linear-to-r from-cyan-500 via-blue-500 to-violet-500 bg-clip-text text-transparent">
											Spotted
										</span>
									</h1>
									<p className="text-lg text-slate-600 leading-relaxed sm:text-xl">
										Spotted is the best way to create and share travel
										itineraries. Curate every place that inspires you, keep it
										organized, and turn it into a beautiful plan when it's time
										to go.
									</p>
								</div>

								<ul className="grid gap-4 text-slate-600 text-sm sm:max-w-xl sm:grid-cols-2">
									<li className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/60 px-4 py-3 shadow-sm ring-1 ring-black/5">
										<span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
										Never lose track of cool places you see online.
									</li>
									<li className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/60 px-4 py-3 shadow-sm ring-1 ring-black/5">
										<span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
										Easily share favorite spots from any trip.
									</li>
									<li className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/60 px-4 py-3 shadow-sm ring-1 ring-black/5">
										<span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
										Create collaborative itineraries in seconds.
									</li>
									<li className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/60 px-4 py-3 shadow-sm ring-1 ring-black/5">
										<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
										Sync across devices and revisit later.
									</li>
								</ul>

								<div className="flex flex-col gap-4 sm:flex-row">
									{isAuthenticated ? (
										<>
											<Link
												className="hover:-translate-y-0.5 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 font-semibold text-base text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
												to="/app"
											>
												Open Spotted
											</Link>
											<Link
												className="hover:-translate-y-0.5 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/70 px-6 py-3 font-semibold text-base text-slate-600 transition hover:bg-white"
												to="/app"
											>
												See saved spots
											</Link>
										</>
									) : (
										<>
											<a
												className="hover:-translate-y-0.5 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 font-semibold text-base text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
												href={signupLink}
											>
												Start planning
											</a>
											<a
												className="hover:-translate-y-0.5 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/70 px-6 py-3 font-semibold text-base text-slate-600 transition hover:bg-white"
												href={signinLink}
											>
												Sign in
											</a>
										</>
									)}
								</div>
							</div>

							<div className="relative">
								<div className="-left-6 absolute top-6 hidden h-24 w-24 rounded-full bg-cyan-200/60 blur-3xl md:block" />
								<div className="-right-4 absolute bottom-10 hidden h-32 w-32 rounded-full bg-violet-200/60 blur-3xl md:block" />
								<div className="relative rounded-3xl border border-white/60 bg-white/80 p-6 shadow-2xl shadow-slate-900/10 ring-1 ring-black/5 backdrop-blur">
									<div className="flex items-center justify-between text-slate-500 text-sm">
										<span>Upcoming weekend</span>
										<span className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-cyan-500/10 to-blue-500/10 px-3 py-1 font-semibold text-cyan-600">
											Live sync
											<span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
										</span>
									</div>
									<h2 className="mt-4 font-semibold text-2xl text-slate-900">
										Lisbon with friends
									</h2>
									<p className="mt-2 mb-6 text-slate-500 text-sm">
										A smart itinerary built from saved spots. Drag, reorder, and
										share instantly.
									</p>

									<div className="space-y-4">
										{previewSpots.map((spot) => (
											<div
												className="group hover:-translate-y-1 flex items-center justify-between rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 shadow-sm transition duration-500 hover:border-slate-200 hover:bg-white"
												key={spot.name}
											>
												<div>
													<p className="font-semibold text-slate-900 text-sm">
														{spot.name}
													</p>
													<p className="text-slate-500 text-xs">{spot.type}</p>
												</div>
												<span className="font-medium text-slate-400 text-xs transition group-hover:text-slate-600">
													{spot.city}
												</span>
											</div>
										))}
									</div>

									<div className="mt-8 rounded-2xl border border-slate-200 border-dashed px-4 py-3 text-slate-500 text-sm">
										+ Add a place from your saved list
									</div>
								</div>
							</div>
						</section>

						<section className="space-y-10">
							<div className="max-w-2xl">
								<p className="font-semibold text-slate-400 text-sm uppercase tracking-[0.3em]">
									Why travelers switch
								</p>
								<h2 className="mt-3 font-semibold text-3xl text-slate-900">
									Built for people who collect places everywhere.
								</h2>
								<p className="mt-4 text-base text-slate-600">
									We designed Spotted to feel light, calm, and collaborative, so
									you can stay in flow whether you're daydreaming or boarding.
								</p>
							</div>

							<div className="grid gap-6 md:grid-cols-3">
								{features.map((feature) => (
									<div
										className="hover:-translate-y-1 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 ring-1 ring-black/5 transition duration-500 hover:ring-slate-900/10"
										key={feature.title}
									>
										<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500/10 to-blue-500/10 text-cyan-600">
											<feature.icon className="h-5 w-5" />
										</div>
										<h3 className="font-semibold text-lg text-slate-900">
											{feature.title}
										</h3>
										<p className="mt-3 text-slate-600 text-sm leading-relaxed">
											{feature.description}
										</p>
									</div>
								))}
							</div>
						</section>

						<section className="rounded-3xl border border-white/70 bg-white/80 p-8 shadow-slate-900/10 shadow-xl ring-1 ring-black/5 backdrop-blur">
							<div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
								<div>
									<p className="font-semibold text-slate-400 text-sm uppercase tracking-[0.35em]">
										Ready when you are
									</p>
									<h2 className="mt-3 font-semibold text-3xl text-slate-900">
										Capture every idea now. Turn it into a trip later.
									</h2>
									<p className="mt-4 text-base text-slate-600">
										Early access is rolling out weekly. Claim your spot and
										bring your friends; shared itineraries feel even better
										together.
									</p>
								</div>
								<div className="flex flex-col gap-4 sm:flex-row">
									{isAuthenticated ? (
										<>
											<Link
												className="hover:-translate-y-0.5 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 font-semibold text-base text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800"
												to="/app"
											>
												Jump back in
											</Link>
											<button
												className="hover:-translate-y-0.5 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 font-semibold text-base text-slate-600 transition hover:bg-slate-50"
												disabled={loading}
												onClick={() => signOut({ returnTo: "/" })}
												type="button"
											>
												{loading ? "Signing out..." : "Switch account"}
											</button>
										</>
									) : (
										<>
											<a
												className="hover:-translate-y-0.5 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 font-semibold text-base text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800"
												href={signupLink}
											>
												Get early access
											</a>
											<a
												className="hover:-translate-y-0.5 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 font-semibold text-base text-slate-600 transition hover:bg-slate-50"
												href={signinLink}
											>
												Sign in
											</a>
										</>
									)}
								</div>
							</div>
						</section>
					</main>
				</div>
			</div>
		</div>
	);
}

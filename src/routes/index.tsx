import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

export const Route = createFileRoute("/")({ component: App });

function App() {
	const { user, loading, signOut } = useAuth();
	const isAuthenticated = !!user;

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
			<div className="w-full max-w-4xl text-center">
				<h1 className="mb-8 font-black font-sans text-7xl text-white tracking-tight md:text-9xl">
					<span className="bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
						Spot
					</span>
				</h1>

				{isAuthenticated ? (
					<div className="space-y-6">
						<p className="text-2xl text-white">
							Welcome back,{" "}
							<span className="font-semibold text-cyan-400">
								{user?.firstName || user?.email?.split("@")[0] || "User"}
							</span>
							!
						</p>
						<Link to="/app">
							<button
								className="transform rounded-lg bg-linear-to-r from-red-500 to-pink-500 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:from-red-600 hover:to-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
								type="button"
							>
								Go to app
							</button>
						</Link>
						<button
							className="ml-4 transform rounded-lg bg-linear-to-r from-red-500 to-pink-500 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:from-red-600 hover:to-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={loading}
							onClick={() => signOut({ returnTo: "/" })}
							type="button"
						>
							{loading ? "Signing out..." : "Sign Out"}
						</button>
					</div>
				) : (
					<>
						<p className="mx-auto mb-12 max-w-2xl text-gray-300 text-xl">
							Your next-generation task management solution
						</p>

						<div className="flex flex-col justify-center gap-4 sm:flex-row">
							<a
								className="transform rounded-lg bg-linear-to-r from-blue-500 to-cyan-500 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:from-blue-600 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
								href="/api/auth/signup"
							>
								{loading ? "Loading..." : "Sign Up"}
							</a>
							<a
								className="rounded-lg border-2 border-gray-600 bg-transparent px-8 py-3 font-semibold text-gray-200 transition-colors hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
								href="/api/auth/login"
							>
								{loading ? "Loading..." : "Sign In"}
							</a>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

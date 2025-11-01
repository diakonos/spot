import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@workos-inc/authkit-react";

export const Route = createFileRoute("/")({ component: App });

function App() {
	const { signOut, user } = useAuth();
	const isAuthenticated = !!user;

	// const handleSignIn = (e: React.MouseEvent<HTMLButtonElement>) => {
	//   e.preventDefault();
	//   signIn();
	// };

	// const handleSignUp = (e: React.MouseEvent<HTMLButtonElement>) => {
	//   e.preventDefault();
	//   signUp();
	// };

	const handleSignOut = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		signOut();
	};

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
						<button
							className="transform rounded-lg bg-linear-to-r from-red-500 to-pink-500 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:from-red-600 hover:to-pink-600"
							onClick={handleSignOut}
							type="button"
						>
							Sign Out
						</button>
					</div>
				) : (
					<>
						<p className="mx-auto mb-12 max-w-2xl text-gray-300 text-xl">
							Your next-generation task management solution
						</p>

						<div className="flex flex-col justify-center gap-4 sm:flex-row">
							<Link
								className="transform rounded-lg bg-linear-to-r from-blue-500 to-cyan-500 px-8 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:from-blue-600 hover:to-cyan-600"
								to="/app"
							>
								Sign Up
							</Link>
							<Link
								className="rounded-lg border-2 border-gray-600 bg-transparent px-8 py-3 font-semibold text-gray-200 transition-colors hover:border-gray-400"
								to="/app"
							>
								Sign In
							</Link>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

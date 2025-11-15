import { Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useEffect } from "react";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export function AppLayout() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const router = useRouter();
	const { profile, isLoading } = useCurrentProfile();
	const pathname = router.state.location.pathname ?? "";
	const isOnboardingRoute = pathname.startsWith("/app/onboarding");

	useEffect(() => {
		if (!user) {
			return;
		}
		if (!isLoading && profile && !profile.username && !isOnboardingRoute) {
			navigate({
				to: "/app/onboarding/username",
				replace: true,
			});
		}
		if (!isLoading && profile?.username && isOnboardingRoute) {
			navigate({
				to: "/app",
				replace: true,
			});
		}
	}, [user, profile, isLoading, isOnboardingRoute, navigate]);

	// if (user && isOnboardingRoute) {
	// 	return <Outlet />;
	// }

	// if (user && (isLoading || profile === null)) {
	// 	return (
	// 		<div className="flex min-h-screen items-center justify-center">
	// 			<p className="text-muted-foreground">Loading your workspace…</p>
	// 		</div>
	// 	);
	// }

	return <Outlet />;
}

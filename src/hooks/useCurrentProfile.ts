import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useQuery as useConvexQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";

export function useCurrentProfile() {
	const { user, loading } = useAuth();

	const queryArgs = useMemo(() => (user ? {} : "skip"), [user]);
	const profile = useConvexQuery(api.users.getCurrentProfile, queryArgs);

	return {
		user,
		isLoading: loading || (user ? profile === undefined : false),
		profile: user ? (profile ?? null) : null,
	};
}

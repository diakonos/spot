import { createFileRoute, redirect } from "@tanstack/react-router";
import { WorkOS } from "@workos-inc/node";

export const Route = createFileRoute("/api/auth/login")({
	server: {
		handlers: {
			GET: () => {
				if (!(process.env.WORKOS_CLIENT_ID && process.env.WORKOS_API_KEY)) {
					throw new Error(
						"WORKOS_CLIENT_ID and WORKOS_API_KEY are required environment variables"
					);
				}
				const workos = new WorkOS(process.env.WORKOS_API_KEY, {
					clientId: process.env.WORKOS_CLIENT_ID,
				});
				const authorizationUrl = workos.userManagement.getAuthorizationUrl({
					// Specify that we'd like AuthKit to handle the authentication flow
					provider: "authkit",

					// The callback endpoint that WorkOS will redirect to after a user authenticates
					redirectUri: "http://localhost:3000/api/auth/callback",
					clientId: process.env.WORKOS_CLIENT_ID,
					screenHint: "sign-in",
				});

				// Redirect the user to the AuthKit sign-in page
				throw redirect({ href: authorizationUrl });
			},
		},
	},
});

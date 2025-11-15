"use node";

import { WorkOS } from "@workos-inc/node";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import http from "../http";

http.route({
	path: "/api/workos/webhooks",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		const signature = req.headers.get("workos-signature");
		if (!signature) {
			return new Response(JSON.stringify({ error: "Missing signature" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Validate environment variables
		const workosApiKey = process.env.WORKOS_API_KEY;
		if (!workosApiKey) {
			throw new Error("Missing WORKOS_API_KEY environment variable");
		}
		const workosWebhookSecret = process.env.WORKOS_WEBHOOK_SECRET;
		if (!workosWebhookSecret) {
			throw new Error("Missing WORKOS_WEBHOOK_SECRET environment variable");
		}

		try {
			const rawBody = await req.text();
			// Verify and construct event using WorkOS SDK
			const workos = new WorkOS(workosApiKey);
			const event = await workos.webhooks.constructEvent({
				payload: rawBody,
				sigHeader: signature,
				secret: workosWebhookSecret,
			});

			const eventType = event.event;
			if (eventType === "user.created" || eventType === "user.updated") {
				// Extract user information
				const workosId = event.data.id;
				const email = event.data.email;
				const firstName = event.data.firstName ?? undefined;
				const lastName = event.data.lastName ?? undefined;

				if (!email) {
					throw new Error("No email found in user data");
				}

				// Upsert user in Convex
				const userId = await ctx.runMutation(internal.users.upsertFromWorkOS, {
					workosId,
					email,
					firstName,
					lastName,
				});

				// Update WorkOS external_id with our Convex user id
				const workosClient = new WorkOS(workosApiKey);
				await workosClient.userManagement.updateUser({
					userId: workosId,
					externalId: userId,
				});
			} else if (eventType === "user.deleted") {
				// Delete user from Convex
				const workosId = event.data.id;
				await ctx.runMutation(internal.users.deleteByWorkOSId, {
					workosId,
				});
			}

			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			// If signature verification failed, return 400
			if (error instanceof Error && error.message.includes("signature")) {
				return new Response(JSON.stringify({ error: "Invalid signature" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Other errors return 500
			return new Response(
				JSON.stringify({ error: "Webhook processing failed" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
	}),
});

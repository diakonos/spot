"use node";

import { WorkOS } from "@workos-inc/node";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import http from "../http";

const LOG_PREFIX = "[workos-webhook]";

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
			const truncatedPayload =
				rawBody.length > 2000 ? `${rawBody.slice(0, 2000)}...[truncated]` : rawBody;
			console.log(LOG_PREFIX, "Received webhook payload", {
				signaturePresent: Boolean(signature),
				payloadPreview: truncatedPayload,
			});

			// Verify and construct event using WorkOS SDK
			const workos = new WorkOS(workosApiKey);
			const event = await workos.webhooks.constructEvent({
				payload: rawBody,
				sigHeader: signature,
				secret: workosWebhookSecret,
			});
			console.log(LOG_PREFIX, "Verified webhook event", {
				eventType: event.event,
				workosId: event.data?.id,
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
				console.log(LOG_PREFIX, "Upserted user from WorkOS", {
					eventType,
					workosId,
					email,
					userId,
				});

				// Update WorkOS external_id with our Convex user id
				const workosClient = new WorkOS(workosApiKey);
				await workosClient.userManagement.updateUser({
					userId: workosId,
					externalId: userId,
				});
				console.log(LOG_PREFIX, "Updated WorkOS user externalId", {
					workosId,
					externalId: userId,
				});
			} else if (eventType === "user.deleted") {
				// Delete user from Convex
				const workosId = event.data.id;
				await ctx.runMutation(internal.users.deleteByWorkOSId, {
					workosId,
				});
				console.log(LOG_PREFIX, "Deleted Convex user via WorkOS event", {
					eventType,
					workosId,
				});
			}

			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			console.error(LOG_PREFIX, "Webhook processing error", error);
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

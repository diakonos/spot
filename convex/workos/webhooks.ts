"use node";

import { WorkOS } from "@workos-inc/node";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

export const handleWorkOSWebhook = internalAction({
	args: {
		payload: v.string(),
		sigHeader: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const workosApiKey = process.env.WORKOS_API_KEY;
		const workosWebhookSecret = process.env.WORKOS_WEBHOOK_SECRET;

		if (!workosApiKey) {
			throw new Error("Missing WORKOS_API_KEY environment variable");
		}
		if (!workosWebhookSecret) {
			throw new Error("Missing WORKOS_WEBHOOK_SECRET environment variable");
		}

		// Verify and construct event using WorkOS SDK
		const workos = new WorkOS(workosApiKey);
		const event = await workos.webhooks.constructEvent({
			payload: JSON.parse(args.payload), // WorkOS expects a JSON object
			sigHeader: args.sigHeader,
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
		// Ignore unknown event types

		return null;
	},
});

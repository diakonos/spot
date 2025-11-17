import { httpRouter } from "convex/server";
import { registerWorkOSWebhooks } from "./workos/webhooks";

const http = httpRouter();

registerWorkOSWebhooks(http);

export default http;

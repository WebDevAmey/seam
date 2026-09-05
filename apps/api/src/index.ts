import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { agentsRoutes } from "./agents/routes.js";
import { chatRoutes } from "./agents/chat/routes.js";
import { analyticsRoutes } from "./analytics/routes.js";
import { authRoutes } from "./auth/routes.js";
import { recoveryActionRoutes } from "./execute/routes.js";
import { digestRoutes } from "./digest/routes.js";
import { internalRoutes } from "./internal/routes.js";
import { intelligenceRoutes } from "./intelligence/routes.js";
import { razorpayWebhookRoutes } from "./ingest/webhooks.razorpay.js";
import { shopifyWebhookRoutes } from "./ingest/webhooks.shopify.js";
import { leakRoutes } from "./leaks/routes.js";
import { ledgerRoutes } from "./ledger/routes.js";
import { merchantRoutes } from "./merchants/routes.js";
import { repliesRoutes } from "./replies/routes.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/", authRoutes);
app.route("/", merchantRoutes);
app.route("/", razorpayWebhookRoutes);
app.route("/", shopifyWebhookRoutes);
app.route("/", internalRoutes);
app.route("/", ledgerRoutes);
app.route("/", leakRoutes);
app.route("/", recoveryActionRoutes);
app.route("/", intelligenceRoutes);
app.route("/", digestRoutes);
app.route("/", repliesRoutes);
app.route("/", analyticsRoutes);
app.route("/", agentsRoutes);
app.route("/", chatRoutes);

const port = Number(process.env.PORT ?? 8080);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`seam-api listening on :${info.port}`);
});

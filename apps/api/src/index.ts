import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { recoveryActionRoutes } from "./execute/routes.js";
import { internalRoutes } from "./internal/routes.js";
import { razorpayWebhookRoutes } from "./ingest/webhooks.razorpay.js";
import { shopifyWebhookRoutes } from "./ingest/webhooks.shopify.js";
import { leakRoutes } from "./leaks/routes.js";
import { ledgerRoutes } from "./ledger/routes.js";
import { merchantRoutes } from "./merchants/routes.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/", merchantRoutes);
app.route("/", razorpayWebhookRoutes);
app.route("/", shopifyWebhookRoutes);
app.route("/", internalRoutes);
app.route("/", ledgerRoutes);
app.route("/", leakRoutes);
app.route("/", recoveryActionRoutes);

const port = Number(process.env.PORT ?? 8080);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`seam-api listening on :${info.port}`);
});

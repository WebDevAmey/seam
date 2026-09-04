import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { razorpayWebhookRoutes } from "./ingest/webhooks.razorpay.js";
import { merchantRoutes } from "./merchants/routes.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/", merchantRoutes);
app.route("/", razorpayWebhookRoutes);

const port = Number(process.env.PORT ?? 8080);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`seam-api listening on :${info.port}`);
});

import { describe, expect, it } from "vitest";
import { SimulatedSmsAdapter, SimulatedWhatsappAdapter } from "./channel-adapter.js";

describe("simulated channel adapters — same interface a real one would have", () => {
  it("SMS adapter reports its channel and a distinct provider ref per send, never a real network call", async () => {
    const adapter = new SimulatedSmsAdapter();
    expect(adapter.channel).toBe("sms");
    const a = await adapter.send({ to: "+919876543210", text: "hello" });
    const b = await adapter.send({ to: "+919876543210", text: "hello" });
    expect(a.sent).toBe(true);
    expect(b.sent).toBe(true);
    if (a.sent && b.sent) {
      expect(a.providerRef).not.toBe(b.providerRef);
      expect(a.providerRef).toContain("simulated-sms");
    }
  });

  it("WhatsApp adapter has the same shape, distinct channel", async () => {
    const adapter = new SimulatedWhatsappAdapter();
    expect(adapter.channel).toBe("whatsapp");
    const result = await adapter.send({ to: "+919876543210", text: "hello" });
    expect(result.sent).toBe(true);
    if (result.sent) expect(result.providerRef).toContain("simulated-whatsapp");
  });
});

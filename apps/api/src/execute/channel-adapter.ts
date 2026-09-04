import { randomUUID } from "node:crypto";

export type SendMessageInput = { to: string; text: string };
export type SendMessageResult = { sent: true; providerRef: string } | { sent: false; error: string };

/**
 * The interface a real WhatsApp Business Cloud API adapter or SMS gateway
 * would implement — both channels are simulated for this build (no Meta
 * Business app credentials exist for this standalone project), but behind
 * the identical interface a real one would use, per PRD §2.4. Swapping in
 * a real implementation later is a one-file change, not a rearchitecture.
 */
export interface ChannelAdapter {
  readonly channel: "sms" | "whatsapp";
  send(input: SendMessageInput): Promise<SendMessageResult>;
}

abstract class SimulatedAdapter implements ChannelAdapter {
  abstract readonly channel: "sms" | "whatsapp";

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const providerRef = `simulated-${this.channel}:${randomUUID()}`;
    // eslint-disable-next-line no-console
    console.log(`[SIMULATED ${this.channel.toUpperCase()}] to=${input.to} ref=${providerRef}\n${input.text}`);
    return { sent: true, providerRef };
  }
}

export class SimulatedSmsAdapter extends SimulatedAdapter {
  readonly channel = "sms" as const;
}

export class SimulatedWhatsappAdapter extends SimulatedAdapter {
  readonly channel = "whatsapp" as const;
}

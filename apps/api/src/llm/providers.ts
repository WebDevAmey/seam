import { createOpenAI } from "@ai-sdk/openai";

/**
 * Groq and OpenRouter both speak the OpenAI chat-completions wire format,
 * so no separate provider package is needed — @ai-sdk/openai's generic
 * client works against either, just pointed at a different base URL and
 * key. Each is picked for a task-specific reason, not interchangeably:
 *
 * - Diagnosis (src/diagnosis/classify-with-openai.ts) is a single-turn,
 *   structured-JSON classification inside a 4s timeout (PRD §8) — Groq's
 *   inference speed is the reason for this pick.
 * - Chat (src/agents/chat/run-chat.ts) is a multi-turn, tool-calling loop
 *   where model breadth matters more than raw speed — OpenRouter is
 *   picked so the underlying model can be swapped from this one file.
 */
const groqClient = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const openRouterClient = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    "HTTP-Referer": "https://github.com/WebDevAmey/seam",
    "X-Title": "Seam",
  },
});

// Both Groq and OpenRouter speak Chat Completions, not OpenAI's newer
// Responses API — @ai-sdk/openai's bare call form (client("model-id"))
// defaults to Responses and 404s against either, so `.chat(...)` is
// required here, not optional.
export function diagnosisModel() {
  return groqClient.chat("openai/gpt-oss-20b");
}

export function chatModel() {
  return openRouterClient.chat("openai/gpt-4o-mini");
}

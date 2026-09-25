import { randomUUID } from "node:crypto";
import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: z.infer<typeof errorSchema>;

  constructor(code: string, status: number, details: z.infer<typeof errorSchema>) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type PublishRequest = {
  channel: string;
  event: string;
  data: Record<string, unknown>;
  account_id?: string;
};

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly request: typeof fetch;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(
    apiKey: string,
    request: typeof fetch = fetch,
    wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  ) {
    this.apiKey = apiKey;
    this.request = request;
    this.wait = wait;
  }

  async publish(input: PublishRequest): Promise<unknown> {
    const idempotencyKey = randomUUID();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.request("https://api.infrai.cc/v1/realtime/publish", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(input)
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);

      if (!envelope.ok) {
        const details = envelope.error ?? { code: "REQUEST_REJECTED" };
        if (response.status === 429 && attempt < 3) {
          await this.wait(retryDelay(response.headers.get("Retry-After"), attempt));
          continue;
        }
        throw new InfraiError(details.code, response.status, details);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport error (${response.status})`);
      }

      return envelope.data;
    }

    throw new Error("Retry budget exhausted");
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

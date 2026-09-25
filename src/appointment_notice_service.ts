import { createServer } from "node:http";
import { ZodError } from "zod";
import { announcementRequestSchema, decideBroadcast } from "./appointment_announcement.js";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const realtime = new InfraiRealtime(apiKey);
const port = Number(process.env.PORT ?? "3000");

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/announcements") {
    return send(response, 404, { error: "Route not found" });
  }

  try {
    const body = announcementRequestSchema.parse(await readJson(request));
    const notice = decideBroadcast(body, new Date());
    await realtime.publish(notice);
    return send(response, 202, {
      accepted: true,
      appointmentRef: body.appointmentRef,
      channel: notice.channel,
      event: notice.event,
      severity: notice.data.severity
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return send(response, 400, { error: "Request body must be valid JSON" });
    }
    if (error instanceof ZodError) {
      return send(response, 400, { error: "Invalid announcement", issues: error.issues });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(response, status, { error: error.message, code: error.code });
    }
    return send(response, 500, { error: "Unable to accept announcement" });
  }
}).listen(port, () => {
  console.log(`Appointment notice service listening on http://localhost:${port}`);
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

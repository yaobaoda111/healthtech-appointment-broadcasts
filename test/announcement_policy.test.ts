import assert from "node:assert/strict";
import test from "node:test";
import { announcementRequestSchema, decideBroadcast } from "../src/appointment_announcement.js";

test("a near-term delay becomes urgent without exposing its internal appointment reference", () => {
  const input = announcementRequestSchema.parse({
    appointmentRef: "patient-safe-internal-ref",
    workflow: "delayed",
    effectiveAt: "2026-09-04T11:00:00.000Z",
    message: "Virtual appointments are running 20 minutes behind schedule."
  });

  const notice = decideBroadcast(input, new Date("2026-09-04T10:00:00.000Z"));

  assert.equal(notice.data.severity, "urgent");
  assert.equal(notice.channel, "healthtech-members");
  assert.equal(JSON.stringify(notice).includes(input.appointmentRef), false);
});

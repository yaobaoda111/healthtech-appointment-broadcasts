import { z } from "zod";

export const announcementRequestSchema = z.object({
  appointmentRef: z.string().min(1).max(80),
  workflow: z.enum(["delayed", "rescheduled", "cancelled", "capacity_restored"]),
  effectiveAt: z.string().datetime(),
  message: z.string().min(1).max(280)
}).strict();

export type AnnouncementRequest = z.infer<typeof announcementRequestSchema>;

export type BroadcastNotice = {
  channel: "healthtech-members";
  event: "appointment.operational_notice";
  data: {
    workflow: AnnouncementRequest["workflow"];
    effective_at: string;
    severity: "info" | "urgent";
    message: string;
  };
};

export function decideBroadcast(input: AnnouncementRequest, now: Date): BroadcastNotice {
  const minutesUntilEffective = (Date.parse(input.effectiveAt) - now.getTime()) / 60_000;
  const severity = input.workflow === "cancelled" || minutesUntilEffective <= 120
    ? "urgent"
    : "info";

  return {
    channel: "healthtech-members",
    event: "appointment.operational_notice",
    data: {
      workflow: input.workflow,
      effective_at: input.effectiveAt,
      severity,
      message: input.message
    }
  };
}

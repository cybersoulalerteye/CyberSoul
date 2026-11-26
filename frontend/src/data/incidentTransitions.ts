import type { IncidentStatus } from "../components/ui";

export const allowedIncidentTransitions: Record<IncidentStatus, IncidentStatus[]> = {
  new: ["assigned"],
  assigned: ["acknowledged"],
  acknowledged: ["investigating"],
  investigating: ["escalated", "resolved"],
  escalated: ["resolved"],
  resolved: ["closed"],
  closed: [],
};

export const AGENDA_TYPES = ["meal", "activity", "visit"] as const;

export type AgendaType = (typeof AGENDA_TYPES)[number];

const LABELS: Record<AgendaType, string> = {
  meal: "Posiłek",
  activity: "Aktywność",
  visit: "Wizyta",
};

export function agendaTypeLabel(type: string): string {
  if (type in LABELS) return LABELS[type as AgendaType];
  return "Punkt dnia";
}

export function isAgendaType(value: string): value is AgendaType {
  return (AGENDA_TYPES as readonly string[]).includes(value);
}

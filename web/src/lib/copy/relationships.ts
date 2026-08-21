export const RELATIONSHIP_CODES = [
  "daughter",
  "son",
  "spouse",
  "grandchild",
  "sibling",
  "legal_guardian",
  "caregiver",
  "other",
] as const;

export type RelationshipCode = (typeof RELATIONSHIP_CODES)[number];

const LABELS: Record<RelationshipCode, string> = {
  daughter: "Córka",
  son: "Syn",
  spouse: "Małżonek / małżonka",
  grandchild: "Wnuk / wnuczka",
  sibling: "Rodzeństwo",
  legal_guardian: "Opiekun prawny",
  caregiver: "Opiekun",
  other: "Inna relacja",
};

export function relationshipLabel(code: string | null | undefined): string {
  if (!code) return "Bliska osoba";
  if (code in LABELS) return LABELS[code as RelationshipCode];
  return "Bliska osoba";
}

export function isRelationshipCode(value: string): value is RelationshipCode {
  return (RELATIONSHIP_CODES as readonly string[]).includes(value);
}

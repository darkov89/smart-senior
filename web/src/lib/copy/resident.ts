export function displayResidentName(
  firstName: string,
  lastNameInitial: string,
): string {
  const initial = lastNameInitial.trim().replace(/\.$/, "");
  return `${firstName.trim()} ${initial}.`;
}

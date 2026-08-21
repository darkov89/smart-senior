import { redirect } from "next/navigation";

export default async function FamilyPersonPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  await params;
  redirect("/rodzina");
}

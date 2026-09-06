import { redirect } from "next/navigation";
export default async function RegistrySubjectRedirect({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  redirect(`/community-board/${subject}`);
}

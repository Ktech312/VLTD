import { redirect } from "next/navigation";
export default function RegistrySubjectRedirect({ params }: { params: { subject: string } }) {
  redirect(`/community-board/${params.subject}`);
}

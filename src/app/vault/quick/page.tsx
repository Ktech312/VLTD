import { Suspense } from "react";
import QuickAddClient from "./QuickAddClient";

export default function QuickAddPage() {
  return (
    <Suspense fallback={null}>
      <QuickAddClient />
    </Suspense>
  );
}

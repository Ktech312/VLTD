export const dynamic = 'force-dynamic'

import StudioPageClient from './StudioPageClient'
import AdminGate from '@/components/admin/AdminGate'

// The content studio is an admin tool: a visitor or a non-admin gets a plain "no access" message (RC-08), not the studio's setup screen.
export default function StudioPage() {
  return (
    <AdminGate>
      <StudioPageClient />
    </AdminGate>
  )
}

import { ProfileEditor } from '@/components/ProfileEditor';
import { PageHeader } from '@/components/ui';
import { getDb } from '@/server/db';
import { getProfile } from '@/server/library';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profile' };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Enter this once. Every resume copies from it, and you can still change what each resume shows." />
      <ProfileEditor initial={getProfile(getDb())} />
    </>
  );
}

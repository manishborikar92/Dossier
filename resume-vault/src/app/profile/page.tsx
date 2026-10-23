import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { PageHeader } from '@/components/ui';
import { getDb } from '@/server/db';
import { getProfile } from '@/server/library';

export const metadata = { title: 'Profile' };

export default function ProfilePage() {
  const profile = getProfile(getDb());
  return (
    <>
      <PageHeader
        title="Profile"
        description="Enter this once. Every resume copies from it, and you can still change what each resume shows."
      />
      <ProfileEditor initial={profile} />
    </>
  );
}

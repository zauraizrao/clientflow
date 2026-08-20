import {
  PortalInvitationAcceptance,
} from "@/components/portal/portal-invitation-acceptance";
import {
  googleOAuthEnabled,
} from "@/lib/server-env";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ClientPortalInvitationPage({
  params,
}: PageProps) {
  const { token } = await params;

  return (
    <PortalInvitationAcceptance
      token={token}
      googleEnabled={
        googleOAuthEnabled
      }
    />
  );
}

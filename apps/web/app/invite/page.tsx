import { Button } from "@repo/ui/button";
import { tsr } from "../tsr";

export default async function InvitePage({
  searchParams
}: {
  searchParams: { inviteId?: string }
}) {
  const inviteId = searchParams.inviteId;
  if (!inviteId) {
    return (
      <div className="flex flex-col h-screen h-full">
        <main className="flex flex-col items-center justify-center gap-3 h-full">
          <h2 className="font-mono">Invalid Invite</h2>
          <p className="text-neutral-400">This invite link is invalid or has expired.</p>
        </main>
        <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
          © {new Date().getFullYear()} envie
        </footer>
      </div>
    );
  }

  const result = await tsr.projects.getProjectByInvite.query({ params: { inviteId } });

  console.log("RESULT",result);
  if (result.status !== 200 && result.body.message) {
    return (
      <div className="flex flex-col h-screen h-full">
        <main className="flex flex-col items-center justify-center gap-3 h-full">
          <h2 className="font-mono">Invalid Invite</h2>
          <p className="text-neutral-400">{result.body.message}</p>
        </main>
        <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
          © {new Date().getFullYear()} envie
        </footer>
      </div>
    );
  }

  const { project, invite } = result.body;
  const expiryDate = invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : null;

  return (
    <div className="flex flex-col h-screen h-full">
      <main className="flex flex-col items-center justify-center gap-4 h-full w-[400px] max-w-full mx-auto px-4">
        <h2 className="font-mono text-xl">envie</h2>
        <h3 className="font-mono text-sm text-neutral-400">You have been invited to join</h3>
        <div className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-sm mb-1">{project.name}</h3>
              {project.description && (
                <p className="text-xs text-neutral-400">{project.description}</p>
              )}
            </div>

            <Button className="w-full text-xs">Join Project</Button>
          </div>
        </div>

        {expiryDate && (
          <div className="text-neutral-500 text-xs">
            Invite expires on {expiryDate}
          </div>
        )}

      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}
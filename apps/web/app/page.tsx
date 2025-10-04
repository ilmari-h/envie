import { LoginButton } from "./components/login-button";
import { LogoutButton } from "./components/logout-button";
import { getAuthenticatedUser } from "./auth/helpers";
import { Button } from "@repo/ui/button";
import Link from "next/link";

export default async function Home() {
  const authenticatedUser = await getAuthenticatedUser();
  return (
    <div className="flex flex-col h-screen h-full">
      <main className={"flex mx-2 flex-col items-center justify-center gap-3 h-full"}>
        <h2 className="font-mono">envie</h2>
        <h4 className="font-mono">Manage your envrionments</h4>
        {authenticatedUser ? (
          <div className="flex flex-col items-center gap-3">
            <Link href="/dashboard" className="w-full">
              <Button variant="accent" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
            <div className="text-neutral-100 font-mono text-xs flex items-center justify-between gap-3">
              <div>Logged in as {authenticatedUser.username}</div>
              <div className="w-px h-4 bg-neutral-700" />

              <LogoutButton />
            </div>
          </div>

        ) : (
          <LoginButton />
        )}
      </main>
      <footer className={`p-2 text-[10px] text-neutral-600 text-center font-medium ${authenticatedUser ? 'md:ml-64' : ''}`}>
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}


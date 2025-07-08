"use client";

import { useSearchParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { tsr } from '../tsr';
import { Loader2, Copy, Check } from 'lucide-react';
import { useState } from 'react';

function isValid32ByteHex(str: string | null): boolean {
  if (!str) return false;
  const base64Regex = /^[A-Za-z0-9_-]+$/;
  return base64Regex.test(str);
}

export default function InvitePage() {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get('inviteId');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!orgData) return;
    await navigator.clipboard.writeText(`envie organization join ${orgData.body.name} ${inviteId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inviteId || !isValid32ByteHex(inviteId)) {
    return <div>Invalid invite code</div>
  }

  const { data: orgData, isLoading: isLoadingOrgData, isError: isErrorOrgData } = tsr.organizations.getOrganizationByInvite.useQuery({
    queryKey: ['organization', inviteId],
    queryData: { params: { token: inviteId } },
  });

  if (isErrorOrgData) {
    return notFound()
  }

  if (!orgData || isLoadingOrgData) {
    return (
      <div className="flex flex-col h-screen h-full">
        <main className="flex flex-col items-center justify-center gap-3 h-full">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          <p className="text-neutral-400 text-xs">Loading...</p>
        </main>
        <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
          © {new Date().getFullYear()} envie
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen h-full">
      <main className="flex flex-col items-center justify-center gap-3 h-full">
        <h2 className="text-neutral-100 font-mono text-sm">Join Organization</h2>
        <p className="text-neutral-400 text-xs">You have been invited to join <span className="font-medium">{orgData?.body.name}</span></p>
        <p className="text-neutral-400 text-xs">Join via the CLI by running:</p>
        <div className="bg-neutral-900 rounded-lg p-3 font-mono text-xs w-fit relative group pr-10">
          <div className="flex items-start">
            <span className="text-neutral-500 select-none">$</span>
            <code className="text-neutral-100 ml-2 break-all">envie organization join {orgData.body.name} {inviteId}</code>
          </div>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-md opacity-50 group-hover:opacity-100 hover:bg-neutral-800 transition-all duration-150"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-neutral-400" />
            )}
          </button>
        </div>
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}
"use client";

import { useEffect, useState } from 'react';

export default function LoginSuccessPage() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    const closeTimer = setTimeout(() => {
      window.close();
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(closeTimer);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen h-full">
      <main className="flex flex-col items-center justify-center gap-3 h-full">
        <h2 className="text-neutral-100 font-mono text-sm">Login successful!</h2>
        <p className="text-neutral-400 text-xs">Successfully logged in. You can now close this page and continue using the CLI.</p>
        <p className="text-neutral-500 text-xs">This window will close in {countdown} seconds...</p>
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  )
}

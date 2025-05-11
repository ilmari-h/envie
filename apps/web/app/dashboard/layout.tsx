
import { Button } from "@repo/ui/button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="max-w-screen-lg mx-auto p-4">
    {children}
  </div>;
}
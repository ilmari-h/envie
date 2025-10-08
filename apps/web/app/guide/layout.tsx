"use server"

import { Sidebar } from "@repo/ui/sidebar";
import { GuideSidebarContent } from "./guide-sidebar-content";
import Footer from "@repo/ui/footer";

export default async function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1">
        <Sidebar header="nvie User Guide">
          <GuideSidebarContent />
        </Sidebar>

        {/* Main content area - positioned next to sidebar */}
        <main className="flex flex-col justify-start gap-8 px-8 py-8a pb-0 md:ml-64 mt-10 flex-1">
          <div className="max-w-[1000px] h-full">
          {children}
          </div>
          <Footer />
        </main>
      </div>

    </div>
  );
}

import { Sidebar } from"./Sidebar";
import { BottomNav } from"./BottomNav";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (<div className="flex min-h-screen bg-bg-base">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>);
}

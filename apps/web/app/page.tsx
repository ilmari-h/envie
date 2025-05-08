import { LoginBox } from "./login-box";

export default function Home() {
  return (
    <div className="flex flex-col h-screen h-full">
      <main className="flex flex-col items-center justify-center gap-3 h-full">
        <h2 className="font-mono">envie</h2>
        <h4 className="font-mono">Manage your envrionments</h4>
        <LoginBox />
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}


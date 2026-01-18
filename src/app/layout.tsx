import type { Metadata } from "next";
import "./globals.css";
import NavTabs from "./components/NavTabs";
import AuthGate from "./components/AuthGate";

export const metadata: Metadata = {
  title: "Surebet App",
  description: "Surebet tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-zinc-950 text-zinc-100">
        <AuthGate>
          <NavTabs />
          {children}
        </AuthGate>
      </body>
    </html>
  );
}

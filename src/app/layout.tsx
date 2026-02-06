import type { Metadata } from "next";
import "./globals.css";
import NavTabs from "./components/NavTabs";
import AuthGate from "./components/AuthGate";
import { UIModeProvider } from "./components/UIModeProvider";


export const metadata: Metadata = {
  title: "Surebet App",
  description: "Surebet tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
  <html lang="it">
    <body>
      <UIModeProvider>
        <AuthGate>
          <NavTabs />
          {children}
        </AuthGate>
      </UIModeProvider>
    </body>
  </html>
);
}

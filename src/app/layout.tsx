import type { Metadata } from "next";
import "./globals.css";
import NavTabs from "./components/NavTabs";
import AuthGate from "./components/AuthGate";
import AppFrame from "./components/AppFrame";

export const metadata: Metadata = {
  title: "Surebet App",
  description: "Surebet tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <AuthGate>
          <AppFrame>
            <NavTabs />
            {children}
          </AppFrame>
        </AuthGate>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import NavTabs from "./components/NavTabs";
import AuthGate from "./components/AuthGate";
import AppFrame from "./components/AppFrame";
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
            <AppFrame>
              <NavTabs />
              {children}
            </AppFrame>
          </AuthGate>
        </UIModeProvider>
      </body>
    </html>
  );
}

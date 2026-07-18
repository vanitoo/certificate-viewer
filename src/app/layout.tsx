import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Certificate Viewer — локальный просмотр X.509",
  description: "Просмотр PEM, DER, CER и CRT сертификатов полностью локально в браузере.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}

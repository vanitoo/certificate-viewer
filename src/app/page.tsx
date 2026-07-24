import packageJson from "../../package.json";
import { AppHeader } from "@/components/layout/app-header";
import { CertificateViewer } from "@/features/certificate-viewer/components/certificate-viewer";

export default function Home() {
  return (
    <div className="app-shell">
      <AppHeader />
      <CertificateViewer />
      <footer style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <span>MIT License · Все операции выполняются на вашем устройстве.</span>
        <span>Версия {packageJson.version}</span>
      </footer>
    </div>
  );
}

import packageJson from "../../package.json";
import { AppHeader } from "@/components/layout/app-header";
import { CertificateViewer } from "@/features/certificate-viewer/components/certificate-viewer";

export default function Home() {
  return (
    <div className="app-shell">
      <AppHeader />
      <CertificateViewer />
      <footer>
        <span>MIT License · Все операции выполняются на вашем устройстве.</span>
        <span className="app-version">Версия {packageJson.version}</span>
      </footer>
    </div>
  );
}

import { AppHeader } from "@/components/layout/app-header";
import { CertificateViewer } from "@/features/certificate-viewer/components/certificate-viewer";

export default function Home() {
  return <div className="app-shell"><AppHeader /><CertificateViewer /><footer>MIT License · Все операции выполняются на вашем устройстве.</footer></div>;
}

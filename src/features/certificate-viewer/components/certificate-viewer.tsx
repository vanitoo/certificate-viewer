"use client";

import { useEffect, useMemo, useState } from "react";
import { CertificateDropzone } from "./certificate-dropzone";
import { parseCertificateFile } from "../lib/parse-certificate";
import type { ParsedCertificate, ParsedCertificateFile } from "../types";
import { formatBytes } from "@/lib/utils";

function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}

function download(name: string, contents: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function date(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

function validityLabel(certificate: ParsedCertificate): string {
  if (certificate.validityStatus === "expired") return "Просрочен";
  if (certificate.validityStatus === "not-yet-valid") return "Ещё не действует";
  return certificate.daysRemaining === 1 ? "Действует ещё 1 день" : `Действует ещё ${certificate.daysRemaining} дн.`;
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="detail-row"><dt>{label}</dt><dd className={mono ? "mono" : ""}>{value}<button className="copy-button" onClick={() => copyText(value)} aria-label={`Копировать: ${label}`}>⧉</button></dd></div>;
}

function CertificateDetails({ certificate }: { certificate: ParsedCertificate }) {
  const san = certificate.extensions.find((extension) => extension.oid === "2.5.29.17");
  return (
    <div className="certificate-content">
      <section className="summary-card">
        <div>
          <div className={`status-pill status-${certificate.validityStatus}`}>{validityLabel(certificate)}</div>
          <h1>{certificate.subjectLabel}</h1>
          <p>Выдан: {certificate.issuerLabel}</p>
        </div>
        <div className="summary-actions">
          <button className="secondary-action" onClick={() => copyText(certificate.pem)}>Копировать PEM</button>
          <button className="secondary-action" onClick={() => download(`${certificate.subjectLabel.replace(/[^a-zа-я0-9]+/gi, "-") || "certificate"}.pem`, certificate.pem, "application/x-pem-file")}>Скачать PEM</button>
        </div>
      </section>

      {certificate.warnings.length > 0 && <section className="warning-grid" aria-label="Предупреждения">
        {certificate.warnings.map((warning, index) => <article className={`warning warning-${warning.level}`} key={`${warning.title}-${index}`}><strong>{warning.title}</strong><span>{warning.description}</span></article>)}
      </section>}

      <section className="panel">
        <h2>Обзор</h2>
        <dl>
          <DetailRow label="Версия" value={`X.509 v${certificate.version}`} />
          <DetailRow label="Серийный номер" value={certificate.serialNumber} mono />
          <DetailRow label="Начало действия" value={date(certificate.notBefore)} />
          <DetailRow label="Окончание действия" value={date(certificate.notAfter)} />
          <DetailRow label="Алгоритм подписи" value={certificate.signatureAlgorithm} />
          <DetailRow label="Открытый ключ" value={`${certificate.publicKeyAlgorithm} · ${certificate.publicKeyDetails}`} />
        </dl>
      </section>

      {san && <section className="panel"><h2>Subject Alternative Name</h2><p className="long-value">{san.value}</p></section>}

      <section className="two-columns">
        <div className="panel"><h2>Subject</h2><dl>{certificate.subject.map((entry, index) => <DetailRow key={`${entry.oid}-${index}`} label={entry.name} value={entry.value} />)}</dl></div>
        <div className="panel"><h2>Issuer</h2><dl>{certificate.issuer.map((entry, index) => <DetailRow key={`${entry.oid}-${index}`} label={entry.name} value={entry.value} />)}</dl></div>
      </section>

      <section className="panel"><h2>Отпечатки</h2><dl><DetailRow label="SHA-256" value={certificate.fingerprints.sha256} mono /><DetailRow label="SHA-1 (устаревший)" value={certificate.fingerprints.sha1} mono /></dl></section>

      <section className="panel"><h2>Расширения <span className="count">{certificate.extensions.length}</span></h2><div className="extensions">{certificate.extensions.length ? certificate.extensions.map((extension, index) => <details key={`${extension.oid}-${index}`}><summary><span>{extension.name}</span><span className="extension-meta">{extension.critical ? "critical · " : ""}{extension.oid}</span></summary><pre>{extension.value}</pre></details>) : <p className="muted">Расширения отсутствуют.</p>}</div></section>

      <section className="panel"><details><summary className="raw-summary">Raw Base64</summary><pre className="raw-data">{certificate.rawBase64}</pre></details></section>
    </div>
  );
}

export function CertificateViewer() {
  const [result, setResult] = useState<ParsedCertificateFile | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => result?.certificates.find((certificate) => certificate.id === selectedId) ?? result?.certificates[0] ?? null, [result, selectedId]);

  async function openFile(file: File) {
    setStatus("reading");
    setError(null);
    try {
      const parsed = await parseCertificateFile(file);
      setResult(parsed);
      setSelectedId(parsed.certificates[0]?.id ?? null);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось разобрать сертификат.");
      setStatus("error");
    }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!result) {
    return <main id="main" className="landing"><section className="hero"><div className="badge">X.509 · полностью локально</div><h1>Разберите сертификат.<br /><span>Не отдавая его интернету.</span></h1><p>Certificate Viewer показывает поля X.509, расширения, срок действия и отпечатки SHA-256/SHA-1 прямо в браузере.</p><div className="privacy-points"><span>Без сервера</span><span>Без регистрации</span><span>Без аналитики</span></div></section><section className="glass-card upload-card"><CertificateDropzone onSelect={openFile} disabled={status === "reading"} />{status === "reading" && <div className="loading">Разбираем ASN.1…</div>}{error && <div className="error-box"><strong>Не удалось открыть файл</strong><span>{error}</span></div>}</section></main>;
  }

  return <main id="main" className="workspace"><aside className="sidebar"><CertificateDropzone onSelect={openFile} compact disabled={status === "reading"} /><div className="file-meta"><strong>{result.fileName}</strong><span>{formatBytes(result.fileSize)} · сертификатов: {result.certificates.length}</span></div><nav className="certificate-list" aria-label="Сертификаты в файле">{result.certificates.map((certificate, index) => <button key={certificate.id} className={certificate.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(certificate.id)}><span className="certificate-index">{index + 1}</span><span><strong>{certificate.subjectLabel}</strong><small>{certificate.issuerLabel}</small></span><i className={`dot dot-${certificate.validityStatus}`} /></button>)}</nav><button className="export-button" onClick={() => download(`${result.fileName}.json`, JSON.stringify(result, null, 2), "application/json")}>Экспорт JSON</button><button className="reset-button" onClick={() => { setResult(null); setSelectedId(null); setStatus("idle"); }}>Закрыть файл</button></aside>{selected && <CertificateDetails certificate={selected} />}</main>;
}

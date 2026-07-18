"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";

interface CertificateDropzoneProps {
  onSelect: (file: File) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function CertificateDropzone({ onSelect, disabled = false, compact = false }: CertificateDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept(files: FileList | null) {
    const file = files?.item(0);
    if (!file) return;
    onSelect(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.key === "Enter" || event.key === " ") && !disabled) {
      event.preventDefault();
      openPicker();
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) accept(event.dataTransfer.files);
  }

  return (
    <div
      className={`dropzone ${compact ? "dropzone-compact" : ""} ${dragging ? "dropzone-active" : ""} ${disabled ? "dropzone-disabled" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input ref={inputRef} hidden type="file" accept=".pem,.der,.cer,.crt,application/x-x509-ca-cert,application/pkix-cert" onChange={(event) => accept(event.target.files)} disabled={disabled} />
      <div className="drop-icon" aria-hidden>⌁</div>
      <div>
        <p className="drop-title">{dragging ? "Отпустите сертификат" : compact ? "Открыть другой файл" : "Перетащите сертификат или цепочку"}</p>
        {!compact && <p className="drop-subtitle">PEM, DER, CER или CRT · до 10 МБ · Ctrl+O</p>}
      </div>
    </div>
  );
}

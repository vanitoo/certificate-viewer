import * as asn1js from "asn1js";
import { Certificate } from "pkijs";
import { oidName } from "./oid-names";
import type {
  CertificateEncoding,
  CertificateExtensionView,
  CertificateWarning,
  DistinguishedNameEntry,
  ParsedCertificate,
  ParsedCertificateFile,
} from "../types";

const PEM_PATTERN = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CERTIFICATES = 100;
const MAX_CERTIFICATE_SIZE = 2 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error("PEM содержит некорректные данные Base64.");
  }
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toPem(bytes: Uint8Array): string {
  const base64 = bytesToBase64(bytes);
  const lines = base64.match(/.{1,64}/g)?.join("\n") ?? base64;
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----\n`;
}

function hex(bytes: Uint8Array, separator = ":"): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(separator);
}

async function digest(name: "SHA-1" | "SHA-256", bytes: Uint8Array): Promise<string> {
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const result = await crypto.subtle.digest(name, source);
  return hex(new Uint8Array(result));
}

function stringifyUnknown(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof ArrayBuffer) return hex(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) return hex(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  if (Array.isArray(value)) return value.map(stringifyUnknown).join(", ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record && Object.keys(record).length <= 3) return stringifyUnknown(record.value);
    const useful = Object.entries(record)
      .filter(([key]) => !["valueBeforeDecodeView", "valueBeforeDecode", "blockLength", "error", "warnings"].includes(key))
      .map(([key, nested]) => `${key}: ${stringifyUnknown(nested)}`)
      .filter((line) => !line.endsWith(": —"));
    return useful.slice(0, 12).join("; ") || "Данные ASN.1";
  }
  return String(value);
}

function parseName(typesAndValues: Certificate["subject"]["typesAndValues"]): DistinguishedNameEntry[] {
  return typesAndValues.map((entry) => ({
    oid: entry.type,
    name: oidName(entry.type),
    value: stringifyUnknown(entry.value.valueBlock.value),
  }));
}

function nameLabel(entries: DistinguishedNameEntry[]): string {
  const commonName = entries.find((entry) => entry.oid === "2.5.4.3")?.value;
  const organization = entries.find((entry) => entry.oid === "2.5.4.10")?.value;
  return commonName || organization || entries.map((entry) => entry.value).filter(Boolean).join(", ") || "Без имени";
}

function extensionValue(extension: NonNullable<Certificate["extensions"]>[number]): string {
  const parsed = extension.parsedValue as unknown;
  if (parsed) return stringifyUnknown(parsed);
  return hex(new Uint8Array(extension.extnValue.valueBlock.valueHexView), " ");
}

function buildWarnings(
  notBefore: Date,
  notAfter: Date,
  signatureOid: string,
  publicKeyOid: string,
  publicKeyDetails: string,
  selfSigned: boolean,
): CertificateWarning[] {
  const now = Date.now();
  const daysRemaining = Math.ceil((notAfter.getTime() - now) / 86_400_000);
  const warnings: CertificateWarning[] = [];

  if (now < notBefore.getTime()) {
    warnings.push({ level: "critical", title: "Ещё не действует", description: "Дата начала действия сертификата находится в будущем." });
  } else if (now > notAfter.getTime()) {
    warnings.push({ level: "critical", title: "Сертификат просрочен", description: `Срок действия закончился ${notAfter.toLocaleDateString("ru-RU")}.` });
  } else if (daysRemaining <= 7) {
    warnings.push({ level: "critical", title: "Истекает менее чем через неделю", description: `Осталось примерно ${daysRemaining} дн.` });
  } else if (daysRemaining <= 30) {
    warnings.push({ level: "warning", title: "Скоро истекает", description: `Осталось примерно ${daysRemaining} дн.` });
  } else if (daysRemaining <= 90) {
    warnings.push({ level: "info", title: "Срок истекает в ближайшие 90 дней", description: `Осталось примерно ${daysRemaining} дн.` });
  }

  if (signatureOid === "1.2.840.113549.1.1.5") {
    warnings.push({ level: "warning", title: "Подпись SHA-1", description: "SHA-1 считается устаревшим алгоритмом для новых сертификатов." });
  }
  if (publicKeyOid === "1.2.840.113549.1.1.1") {
    const bits = Number(publicKeyDetails.match(/(\d+) bit/)?.[1] ?? 0);
    if (bits > 0 && bits < 2048) warnings.push({ level: "warning", title: "Слабый RSA-ключ", description: `Размер ключа ${bits} бит, рекомендуется не менее 2048 бит.` });
  }
  if (selfSigned) {
    warnings.push({ level: "info", title: "Самоподписанный сертификат", description: "Subject и Issuer совпадают. Это не означает автоматического доверия." });
  }
  return warnings;
}

function sameName(left: DistinguishedNameEntry[], right: DistinguishedNameEntry[]): boolean {
  return JSON.stringify(left.map(({ oid, value }) => [oid, value])) === JSON.stringify(right.map(({ oid, value }) => [oid, value]));
}

function publicKeyDetails(certificate: Certificate): string {
  const algorithmOid = certificate.subjectPublicKeyInfo.algorithm.algorithmId;
  if (algorithmOid === "1.2.840.113549.1.1.1") {
    const bitLength = certificate.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView.byteLength * 8;
    return `${bitLength} bit`;
  }
  const parameters = certificate.subjectPublicKeyInfo.algorithm.algorithmParams;
  return parameters ? stringifyUnknown(parameters.toJSON()) : "—";
}

async function parseOne(bytes: Uint8Array, fileName: string, encoding: CertificateEncoding, sourceIndex: number): Promise<ParsedCertificate> {
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const asn1 = asn1js.fromBER(source);
  if (asn1.offset === -1) throw new Error(`Сертификат №${sourceIndex + 1} содержит некорректную ASN.1/DER-структуру.`);

  const certificate = new Certificate({ schema: asn1.result });
  const subject = parseName(certificate.subject.typesAndValues);
  const issuer = parseName(certificate.issuer.typesAndValues);
  const notBefore = certificate.notBefore.value;
  const notAfter = certificate.notAfter.value;
  const now = Date.now();
  const validityStatus = now < notBefore.getTime() ? "not-yet-valid" : now > notAfter.getTime() ? "expired" : "valid";
  const daysRemaining = Math.ceil((notAfter.getTime() - now) / 86_400_000);
  const signatureOid = certificate.signatureAlgorithm.algorithmId;
  const publicKeyOid = certificate.subjectPublicKeyInfo.algorithm.algorithmId;
  const keyDetails = publicKeyDetails(certificate);
  const extensions: CertificateExtensionView[] = (certificate.extensions ?? []).map((extension) => ({
    oid: extension.extnID,
    name: oidName(extension.extnID),
    critical: extension.critical,
    value: extensionValue(extension),
  }));

  return {
    id: `${sourceIndex}-${hex(new Uint8Array(certificate.serialNumber.valueBlock.valueHexView), "")}`,
    sourceIndex,
    encoding,
    fileName,
    byteLength: bytes.byteLength,
    pem: toPem(bytes),
    version: certificate.version + 1,
    serialNumber: hex(new Uint8Array(certificate.serialNumber.valueBlock.valueHexView), ""),
    subject,
    issuer,
    subjectLabel: nameLabel(subject),
    issuerLabel: nameLabel(issuer),
    notBefore: notBefore.toISOString(),
    notAfter: notAfter.toISOString(),
    validityStatus,
    daysRemaining,
    signatureAlgorithm: oidName(signatureOid),
    publicKeyAlgorithm: oidName(publicKeyOid),
    publicKeyDetails: keyDetails,
    fingerprints: {
      sha256: await digest("SHA-256", bytes),
      sha1: await digest("SHA-1", bytes),
    },
    extensions,
    warnings: buildWarnings(notBefore, notAfter, signatureOid, publicKeyOid, keyDetails, sameName(subject, issuer)),
    rawBase64: bytesToBase64(bytes),
  };
}

export async function parseCertificateFile(file: File): Promise<ParsedCertificateFile> {
  if (file.size === 0) throw new Error("Файл пуст.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Файл слишком большой. Максимальный размер — 10 МБ.");

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const matches = Array.from(text.matchAll(PEM_PATTERN));

  if (matches.length > MAX_CERTIFICATES) {
    throw new Error(`В файле слишком много сертификатов. Максимум — ${MAX_CERTIFICATES}.`);
  }

  const sources = matches.length > 0
    ? matches.map((match) => ({ bytes: base64ToBytes(match[1]), encoding: "pem" as const }))
    : [{ bytes, encoding: "der" as const }];

  if (sources.some((source) => source.bytes.byteLength > MAX_CERTIFICATE_SIZE)) {
    throw new Error("Один из сертификатов превышает допустимый размер 2 МБ.");
  }

  const certificates = await Promise.all(sources.map((source, index) => parseOne(source.bytes, file.name, source.encoding, index)));
  return { fileName: file.name, fileSize: file.size, certificates };
}

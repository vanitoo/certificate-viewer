export type CertificateEncoding = "pem" | "der";
export type ValidityStatus = "valid" | "expired" | "not-yet-valid";
export type WarningLevel = "info" | "warning" | "critical";

export interface DistinguishedNameEntry {
  oid: string;
  name: string;
  value: string;
}

export interface CertificateExtensionView {
  oid: string;
  name: string;
  critical: boolean;
  value: string;
}

export interface CertificateWarning {
  level: WarningLevel;
  title: string;
  description: string;
}

export interface ParsedCertificate {
  id: string;
  sourceIndex: number;
  encoding: CertificateEncoding;
  fileName: string;
  byteLength: number;
  pem: string;
  version: number;
  serialNumber: string;
  subject: DistinguishedNameEntry[];
  issuer: DistinguishedNameEntry[];
  subjectLabel: string;
  issuerLabel: string;
  notBefore: string;
  notAfter: string;
  validityStatus: ValidityStatus;
  daysRemaining: number;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeyDetails: string;
  fingerprints: {
    sha256: string;
    sha1: string;
  };
  extensions: CertificateExtensionView[];
  warnings: CertificateWarning[];
  rawBase64: string;
}

export interface ParsedCertificateFile {
  fileName: string;
  fileSize: number;
  certificates: ParsedCertificate[];
}

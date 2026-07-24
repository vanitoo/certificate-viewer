import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { oidName } from "./oid-names";
import { parseCertificateFile } from "./parse-certificate";

function fixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8").trim();
}

function textFile(contents: string, name = "certificate.pem"): File {
  return new File([contents], name, { type: "application/x-pem-file" });
}

function derFile(base64: string, name = "certificate.der"): File {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new File([bytes], name, { type: "application/pkix-cert" });
}

function warningTitles(file: Awaited<ReturnType<typeof parseCertificateFile>>): string[] {
  return file.certificates[0].warnings.map((warning) => warning.title);
}

const VALID_PEM = fixture("valid.pem");

 describe("parseCertificateFile", () => {
  it("parses a valid PEM certificate", async () => {
    const result = await parseCertificateFile(textFile(VALID_PEM));
    const certificate = result.certificates[0];

    expect(result.fileName).toBe("certificate.pem");
    expect(result.certificates).toHaveLength(1);
    expect(certificate).toMatchObject({
      encoding: "pem",
      subjectLabel: "valid.test",
      issuerLabel: "valid.test",
      version: 3,
      publicKeyAlgorithm: "RSA",
    });
    expect(certificate.fingerprints.sha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(warningTitles(result)).toContain("Самоподписанный сертификат");
  });

  it("parses a valid DER certificate and produces the same fingerprint as PEM", async () => {
    const pem = await parseCertificateFile(textFile(VALID_PEM));
    const der = await parseCertificateFile(derFile(fixture("valid.der.b64")));

    expect(der.certificates).toHaveLength(1);
    expect(der.certificates[0]).toMatchObject({
      encoding: "der",
      subjectLabel: "valid.test",
      issuerLabel: "valid.test",
    });
    expect(der.certificates[0].fingerprints.sha256).toBe(pem.certificates[0].fingerprints.sha256);
  });

  it("parses every certificate in a PEM bundle", async () => {
    const result = await parseCertificateFile(textFile(`${VALID_PEM}\n${VALID_PEM}`, "bundle.pem"));

    expect(result.certificates).toHaveLength(2);
    expect(result.certificates.map((certificate) => certificate.sourceIndex)).toEqual([0, 1]);
  });

  it("marks an expired certificate and creates a critical warning", async () => {
    const result = await parseCertificateFile(textFile(fixture("expired.pem"), "expired.pem"));

    expect(result.certificates[0].validityStatus).toBe("expired");
    expect(result.certificates[0].daysRemaining).toBeLessThan(0);
    expect(warningTitles(result)).toContain("Сертификат просрочен");
  });

  it("marks a certificate that is not valid yet", async () => {
    const result = await parseCertificateFile(textFile(fixture("future.pem"), "future.pem"));

    expect(result.certificates[0].validityStatus).toBe("not-yet-valid");
    expect(warningTitles(result)).toContain("Ещё не действует");
  });

  it("warns about a SHA-1 signature", async () => {
    const result = await parseCertificateFile(textFile(fixture("sha1.pem"), "sha1.pem"));

    expect(result.certificates[0].signatureAlgorithm).toBe("SHA-1 with RSA");
    expect(warningTitles(result)).toContain("Подпись SHA-1");
  });

  it("warns about an RSA key smaller than 2048 bits", async () => {
    const result = await parseCertificateFile(textFile(fixture("rsa1024.pem"), "rsa1024.pem"));
    const bits = Number(result.certificates[0].publicKeyDetails.match(/(\d+) bit/)?.[1]);

    expect(bits).toBeGreaterThan(0);
    expect(bits).toBeLessThan(2048);
    expect(warningTitles(result)).toContain("Слабый RSA-ключ");
  });

  it("maps distinguished-name and extension OIDs without losing unknown OIDs", async () => {
    const result = await parseCertificateFile(textFile(VALID_PEM));
    const certificate = result.certificates[0];
    const extensions = new Map(certificate.extensions.map((extension) => [extension.oid, extension]));

    expect(certificate.subject).toEqual(expect.arrayContaining([
      expect.objectContaining({ oid: "2.5.4.3", name: "Common Name", value: "valid.test" }),
      expect.objectContaining({ oid: "2.5.4.10", name: "Organization", value: "Certificate Viewer Tests" }),
      expect.objectContaining({ oid: "2.5.4.6", name: "Country", value: "RU" }),
    ]));

    expect(extensions.get("2.5.29.17")?.name).toBe("Subject Alternative Name");
    expect(extensions.get("2.5.29.15")).toMatchObject({ name: "Key Usage", critical: true });
    expect(extensions.get("2.5.29.37")?.name).toBe("Extended Key Usage");
    expect(extensions.get("2.5.29.19")).toMatchObject({ name: "Basic Constraints", critical: true });
    expect(extensions.get("1.3.6.1.5.5.7.1.1")?.name).toBe("Authority Information Access");
    expect(extensions.get("2.5.29.31")?.name).toBe("CRL Distribution Points");
    expect(extensions.get("1.2.3.4.5.6.7")?.name).toBe("1.2.3.4.5.6.7");
    expect(oidName("1.2.3.4.5.6.7")).toBe("1.2.3.4.5.6.7");
  });

  it("rejects an empty file", async () => {
    await expect(parseCertificateFile(textFile(""))).rejects.toThrow("Файл пуст.");
  });

  it("rejects malformed PEM Base64", async () => {
    const malformed = "-----BEGIN CERTIFICATE-----\nnot_base64!\n-----END CERTIFICATE-----";
    await expect(parseCertificateFile(textFile(malformed))).rejects.toThrow("PEM содержит некорректные данные Base64.");
  });

  it("rejects malformed DER", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "broken.der", { type: "application/pkix-cert" });
    await expect(parseCertificateFile(file)).rejects.toThrow(/ASN\.1\/DER/);
  });

  it("rejects files larger than 10 MB", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "too-large.der");
    await expect(parseCertificateFile(file)).rejects.toThrow("Файл слишком большой. Максимальный размер — 10 МБ.");
  });

  it("rejects bundles with more than 100 certificates", async () => {
    const bundle = Array.from({ length: 101 }, () => VALID_PEM).join("\n");
    await expect(parseCertificateFile(textFile(bundle, "too-many.pem"))).rejects.toThrow("В файле слишком много сертификатов. Максимум — 100.");
  });

  it("rejects an individual certificate larger than 2 MB", async () => {
    const oversizedBase64 = "A".repeat(Math.ceil((2 * 1024 * 1024 + 1) / 3) * 4);
    const pem = `-----BEGIN CERTIFICATE-----\n${oversizedBase64}\n-----END CERTIFICATE-----`;
    await expect(parseCertificateFile(textFile(pem, "oversized.pem"))).rejects.toThrow("Один из сертификатов превышает допустимый размер 2 МБ.");
  });
});

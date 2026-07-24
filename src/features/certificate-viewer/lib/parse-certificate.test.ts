import { describe, expect, it } from "vitest";
import { parseCertificateFile } from "./parse-certificate";

const CERTIFICATE_PEM = `-----BEGIN CERTIFICATE-----
MIIDvDCCAqSgAwIBAgIUD/JnB8J1qzhUey3aR+Q4//oL/G0wDQYJKoZIhvcNAQEL
BQAwTDEgMB4GA1UEAwwXY2VydGlmaWNhdGUtdmlld2VyLnRlc3QxGzAZBgNVBAoM
EkNlcnRpZmljYXRlIFZpZXdlcjELMAkGA1UEBhMCUlUwHhcNMjYwNzI0MTM1NDAx
WhcNMzYwNzIxMTM1NDAxWjBMMSAwHgYDVQQDDBdjZXJ0aWZpY2F0ZS12aWV3ZXIu
dGVzdDEbMBkGA1UECgwSQ2VydGlmaWNhdGUgVmlld2VyMQswCQYDVQQGEwJSVTCC
ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANLoSjBM/j++E+W9U7UpezOl
Ik20xfCDJqwPzXS6tXzAJdfpnH9wYgaDpsUjw6Zzayo74jly55ZAGbCzwhfhBPxd
GB7l4TOTUtDsBHUj8Mbg7vKkbyu9gyJXFrRDXAtY8eZwvnIeo7FJVDArJb1oJMdH
xe3c414S8MLDvT2xv0o5/ws5bcqVbjFUk74lpWY5KEIR2Ic6OSUzch5P/7qDlG/w
eR0B8UXKBw7RdQuMfU9+U54bck3fdCla4zLVAs2myxA0z4+bUy1xTGYtMJIqUel7
eM6LjRzrOtOlyEDr9HJmQGfO5Wer5/MiaA/JHn9ERNPVFfWOTX6E16g69wbwPMkC
AwEAAaOBlTCBkjAdBgNVHQ4EFgQU8VXjPZJoXl3EfkukF36gQ4EflewwHwYDVR0j
BBgwFoAU8VXjPZJoXl3EfkukF36gQ4EflewwDwYDVR0TAQH/BAUwAwEB/zA/BgNV
HREEODA2ghdjZXJ0aWZpY2F0ZS12aWV3ZXIudGVzdIIbd3d3LmNlcnRpZmljYXRl
LXZpZXdlci50ZXN0MA0GCSqGSIb3DQEBCwUAA4IBAQAvPzUfXLw4sTPGP821nCI4
BzLAJP9fz0lRJpn6p7KRnGhePqySHuEd6FMd2sIL4esjuJUJBPL3pPrliseHTqlx
nwSkhNMVEoVK63AWPesFDw0CjtZzB5xUak2kahnfT1OiGkCApu9XCarDBodEoBmU
CQduZb/MtYPHYjqJb4ekfD8fTkDuYimolXZSac3jfkj1JsQ/j3BJeqp55K1n21LE
aoinGS1zTrApGb5ncoosDb1byBeDugHlN8Redi1Xl7QoCxr+l+L4wZfFt4Ilvv3E
ZchqDJ1bgtWW/dIiiHr6KWCWpkGsD0yxznhcYsjqvggm0LUMTz/PvICivuhRBTiO
-----END CERTIFICATE-----`;

function textFile(contents: string, name = "certificate.pem"): File {
  return new File([contents], name, { type: "application/x-pem-file" });
}

describe("parseCertificateFile", () => {
  it("parses a valid PEM certificate", async () => {
    const result = await parseCertificateFile(textFile(CERTIFICATE_PEM));

    expect(result.fileName).toBe("certificate.pem");
    expect(result.certificates).toHaveLength(1);
    expect(result.certificates[0]).toMatchObject({
      encoding: "pem",
      subjectLabel: "certificate-viewer.test",
      issuerLabel: "certificate-viewer.test",
      version: 3,
      publicKeyAlgorithm: "RSA",
    });
    expect(result.certificates[0].fingerprints.sha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(result.certificates[0].warnings.some((warning) => warning.title === "Самоподписанный сертификат")).toBe(true);
  });

  it("parses every certificate in a PEM bundle", async () => {
    const result = await parseCertificateFile(textFile(`${CERTIFICATE_PEM}\n${CERTIFICATE_PEM}`, "bundle.pem"));

    expect(result.certificates).toHaveLength(2);
    expect(result.certificates.map((certificate) => certificate.sourceIndex)).toEqual([0, 1]);
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
    const bundle = Array.from({ length: 101 }, () => CERTIFICATE_PEM).join("\n");
    await expect(parseCertificateFile(textFile(bundle, "too-many.pem"))).rejects.toThrow("В файле слишком много сертификатов. Максимум — 100.");
  });

  it("rejects an individual certificate larger than 2 MB", async () => {
    const oversizedBase64 = "A".repeat(Math.ceil((2 * 1024 * 1024 + 1) / 3) * 4);
    const pem = `-----BEGIN CERTIFICATE-----\n${oversizedBase64}\n-----END CERTIFICATE-----`;
    await expect(parseCertificateFile(textFile(pem, "oversized.pem"))).rejects.toThrow("Один из сертификатов превышает допустимый размер 2 МБ.");
  });
});

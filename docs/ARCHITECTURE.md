# Architecture

Certificate Viewer является статическим browser-only приложением.

## Поток данных

1. Пользователь выбирает файл через dropzone.
2. `parseCertificateFile` определяет PEM или DER по содержимому, а не по расширению.
3. PEM bundle разбивается на отдельные DER-блоки.
4. ASN1.js декодирует DER, PKI.js строит модель X.509.
5. Доменные данные нормализуются в `ParsedCertificate`.
6. Web Crypto рассчитывает SHA-256 и SHA-1 fingerprints.
7. React отображает результат и позволяет экспортировать JSON/PEM.

## Границы модулей

- `app`: композиция страницы и глобальные стили;
- `components/layout`: общий каркас;
- `features/certificate-viewer/components`: UI функции;
- `features/certificate-viewer/lib`: парсинг и OID;
- `features/certificate-viewer/types`: доменная модель.

Парсер изолирован от React. Это позволяет позднее перенести вычисления в Web Worker без изменения UI-контракта.

## Безопасность

- сетевые запросы отсутствуют;
- файлы читаются только через File API;
- данные не сохраняются в localStorage/IndexedDB;
- PFX и приватные ключи пока не поддерживаются;
- размер входного файла ограничен 10 МБ.

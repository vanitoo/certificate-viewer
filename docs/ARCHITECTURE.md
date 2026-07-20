# Архитектура

Certificate Viewer — статическое browser-only приложение на Next.js. `output: "export"` создает каталог `out/`; серверная часть во время работы отсутствует.

## Поток данных

1. Пользователь выбирает файл через dropzone.
2. `parseCertificateFile` проверяет общий размер и определяет PEM или DER по содержимому.
3. PEM bundle делится на блоки с лимитом 100 сертификатов; каждый декодированный сертификат ограничен 2 МБ.
4. ASN1.js декодирует DER, PKI.js строит модель X.509.
5. Данные нормализуются в `ParsedCertificate`, Web Crypto рассчитывает SHA-256/SHA-1.
6. React отображает значения как текст и позволяет локально скачать JSON/PEM.

Файл существует в памяти вкладки и не записывается в браузерное хранилище. В приложении нет API routes, fetch-вызовов, аналитики и телеметрии.

## Границы модулей

- `src/app` — композиция страницы, metadata и глобальные стили;
- `src/components/layout` — общий каркас;
- `src/features/certificate-viewer/components` — пользовательский интерфейс;
- `src/features/certificate-viewer/lib` — парсинг и справочник OID;
- `src/features/certificate-viewer/types` — доменная модель.

Парсер не зависит от React. Следующий уровень защиты от CPU/память DoS — перенос его в Web Worker с тайм-аутом.

## Доставка

- `ci.yml` проверяет типы, lint и production build;
- `security.yml` запускает audit зависимостей, CodeQL и проверку dependency diff;
- `deploy-pages.yml` собирает приложение с repository-aware `basePath` и публикует artifact через GitHub Pages;
- Dependabot предлагает обновления npm и Actions.

# Certificate Viewer

Локальный просмотрщик X.509-сертификатов. PEM, DER, CER и CRT обрабатываются только в браузере: файл не загружается на сервер и не покидает устройство.

**Демо:** <https://vanitoo.github.io/certificate-viewer/>

## Возможности

- просмотр одного сертификата или PEM-цепочки;
- Subject, Issuer, серийный номер, срок действия и расширения X.509;
- алгоритмы подписи и открытого ключа;
- отпечатки SHA-256 и SHA-1;
- предупреждения об истечении срока, SHA-1, слабом RSA-ключе и самоподписанном сертификате;
- копирование и экспорт в JSON/PEM;
- Drag & Drop и `Ctrl+O`;
- адаптивный интерфейс и статическая сборка для GitHub Pages.

> Приложение разбирает структуру сертификата, но не строит доверенную цепочку и не проверяет OCSP/CRL. Успешный разбор не означает, что сертификату можно доверять.

## Локальный запуск

Требуется Node.js 22 и npm.

```bash
npm ci
npm run dev
```

Полная проверка перед коммитом:

```bash
npm run check
```

Статический сайт будет создан в каталоге `out/` командой `npm run build`.

## Публикация в GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` автоматически проверяет и публикует `main`. В настройках репозитория один раз выберите **Settings → Pages → Source: GitHub Actions**. Ручной повторный запуск доступен через **Actions → Deploy GitHub Pages → Run workflow**.

Для project page базовый путь вычисляется из `GITHUB_REPOSITORY`, поэтому CSS и JavaScript работают по адресу `/certificate-viewer/`.

## Безопасность

Входной файл ограничен 10 МБ, отдельный сертификат — 2 МБ, PEM bundle — 100 сертификатами. React экранирует отображаемые значения; приложение не использует `dangerouslySetInnerHTML`, аналитику или сетевую отправку файлов.

CI выполняет typecheck, lint и production build. Отдельный workflow запускает `npm audit`, CodeQL и dependency review; Dependabot следит за npm-пакетами и GitHub Actions. Подробности: [SECURITY.md](SECURITY.md) и [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).

## Документация

- [Архитектура](docs/ARCHITECTURE.md)
- [Участие в разработке](CONTRIBUTING.md)
- [История версий](CHANGELOG.md)
- [Планы](TODO.md)

Лицензия — [MIT](LICENSE).


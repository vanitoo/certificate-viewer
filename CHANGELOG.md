# История изменений

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), проект использует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Добавлено

- Vitest как тестовый раннер;
- unit-тесты парсера для валидного PEM и PEM bundle;
- негативные тесты пустого файла, повреждённого Base64 и повреждённого DER;
- тесты ограничений 10 МБ на файл, 2 МБ на сертификат и 100 сертификатов на bundle;
- команды `npm test` и `npm run test:watch`.

### Изменено

- `npm run check` теперь включает unit-тесты перед production build;
- GitHub Actions обновлены до актуальных major-версий: `checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v5`, `deploy-pages@v5`, `codeql-action@v4`;
- Dependabot ограничен minor/patch-обновлениями для npm и GitHub Actions;
- CI, Security и Pages временно устанавливают зависимости напрямую из публичного npm registry, не используя непереносимый lock-файл;
- README, архитектура, аудит безопасности, руководство участника и roadmap приведены в соответствие с текущим состоянием проекта.

### Исправлено

- устранено падение GitHub Pages и проверок pull request из-за внутренних URL npm mirror в `package-lock.json`.

### Технический долг

- требуется регенерировать чистый `package-lock.json` через `registry.npmjs.org` и вернуть воспроизводимую установку `npm ci` во все workflow;
- тестовые сертификаты пока встроены в test-файл; позже их нужно вынести в отдельные fixtures и добавить валидный DER fixture.

## [0.2.0] — 2026-07-20

### Добавлено

- автоматическая публикация статической сборки в GitHub Pages;
- security workflow с `npm audit`, CodeQL и dependency review;
- Dependabot для npm и GitHub Actions;
- лимиты размера отдельного сертификата и количества сертификатов в PEM bundle;
- строгая проверка Base64 в PEM;
- отчёт об аудите безопасности.

### Изменено

- CI использует единую команду `npm run check`;
- Next.js и ESLint config обновлены с 16.1.4 до 16.2.10 для устранения high-severity advisory;
- обновлены README, политика безопасности, архитектура, руководство участника и планы.

## [0.1.0] — 2026-07-20

### Добавлено

- локальный просмотр PEM, DER, CER и CRT;
- разбор PEM bundles с несколькими сертификатами;
- основные поля X.509, расширения, fingerprints и предупреждения;
- экспорт JSON и PEM, копирование значений и адаптивный интерфейс.

[Unreleased]: https://github.com/vanitoo/certificate-viewer/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/vanitoo/certificate-viewer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vanitoo/certificate-viewer/releases/tag/v0.1.0

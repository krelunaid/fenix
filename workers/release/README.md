# Worker native Fenix (iOS / Android)

Netlify Linux non ha Xcode e la Function può scadere. Build, firma e upload
**non** girano nella request: il job viene persistito su Postgres, poi
dispatchato a un runner reale.

## Requisiti

### iOS (macOS)

- Runner `macos-latest` o Mac dedicato con **Xcode** (14+) e `xcodebuild`.
- Account App Store Connect, ruolo **App Manager o Admin**.
- Secret server-only: `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (.p8),
  `APPLE_TEAM_ID`.
- Workflow: `.github/workflows/release-ios.yml` (`workflow_dispatch`).

### Android (Linux)

- Runner Ubuntu con **JDK 17** e Android SDK (`bundleRelease`).
- Play Console, ruolo **Release Manager**.
- Secret server-only: `GOOGLE_PLAY_SERVICE_ACCOUNT` (JSON),
  `ANDROID_KEYSTORE_PATH`, `ANDROID_KEY_ALIAS`, `ANDROID_STORE_PASSWORD`,
  `ANDROID_KEY_PASSWORD`.
- Workflow: `.github/workflows/release-android.yml`.

### Comune

- `DATABASE_URL` (Neon) — il worker legge/scrive `release_jobs`.
- `FENIX_RELEASE_GITHUB_TOKEN` + `FENIX_RELEASE_GITHUB_REPO` sul sito Netlify
  per il dispatch (`workflow_dispatch`). Non si inventano token.
- `FENIX_RELEASE_CALLBACK_SECRET` (≥16) e `FENIX_RELEASE_CALLBACK_URL`
  (`https://<sito>/api/release/callback`) per il callback HMAC.
- `FENIX_RELEASE_WORKER=ios|android` sul runner: disattiva un secondo dispatch.

Web resta nella Function Netlify.

## Locale

`FENIX_NATIVE_DISPATCH=0` (default fuori Netlify) esegue i comandi in-process
se Xcode/SDK sono installati. Su Netlify il default è dispatch.

Fixture (`FENIX_RELEASE_FIXTURE=1`) non chiama store né worker.

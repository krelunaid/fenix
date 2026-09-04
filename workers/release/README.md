# Worker native Fenix (iOS / Android)

Netlify Linux non ha Xcode e la Function può scadere. Build, firma e upload
**non** girano nella request: il job viene persistito su Postgres, poi
**un solo** `workflow_dispatch` per piattaforma esegue l'intera FSM nativa
(build → sign → upload) **sullo stesso runner**. Dopo ogni side effect il
worker persiste gli id provider e invia un callback HMAC.

## Requisiti

### iOS (macOS)

- Runner `macos-latest` o Mac dedicato con **Xcode** (14+) e `xcodebuild`.
- Account App Store Connect, ruolo **App Manager o Admin**.
- Secret inevitabili (server-only):
  - `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (.p8)
  - `APPLE_TEAM_ID`
- Il worker materializza `AuthKey_{keyId}.p8` e passa a `xcodebuild`
  `-allowProvisioningUpdates`, `-authenticationKeyPath`, `-authenticationKeyID`,
  `-authenticationKeyIssuerID` e `DEVELOPMENT_TEAM`.
- Se il team non usa il provisioning automatico, aggiungi anche:
  - `APPLE_DISTRIBUTION_P12_BASE64`
  - `APPLE_DISTRIBUTION_P12_PASSWORD`
  - `APPLE_PROVISIONING_PROFILE_BASE64` (opzionale)
  Il P12 entra in una keychain temporanea e viene cancellato in `finally`.
- Workflow: `.github/workflows/release-ios.yml` (`workflow_dispatch`, un job).

### Android (Linux)

- Runner Ubuntu con **JDK 17**. Il workflow installa **Gradle 8.7**
  (`gradle/actions/setup-gradle`) e, se manca, scarica `gradle-wrapper.jar`
  con SHA-256 fissato (`cb0da6751c2b753a16ac168bb354870ebb1e162e9083f116729cec9c781156b8`).
- Play Console, ruolo **Release Manager**.
- Secret inevitabili (server-only):
  - `GOOGLE_PLAY_SERVICE_ACCOUNT` (JSON)
  - `ANDROID_KEYSTORE_BASE64` (binario, non un path su un runner fresco)
  - `ANDROID_KEY_ALIAS`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`
- `ANDROID_KEYSTORE_PATH` vale solo se il file esiste già sul runner.
  Altrimenti il worker decodifica il base64 in un file temp `0600`, lo passa
  a `jarsigner` e lo cancella. Mai log di contenuto o password.
- Workflow: `.github/workflows/release-android.yml`.

### Comune

- `DATABASE_URL` (Neon) — il worker legge/scrive `release_jobs`.
- `FENIX_RELEASE_GITHUB_TOKEN` + `FENIX_RELEASE_GITHUB_REPO` sul sito Netlify
  per il dispatch (`workflow_dispatch`). Non si inventano token.
- `FENIX_RELEASE_CALLBACK_SECRET` (≥16) e `FENIX_RELEASE_CALLBACK_URL`
  (`https://<sito>/api/release/callback`) per il callback HMAC
  (`jobId+platform+step+runId+status+artifactHash+ts`).
- `FENIX_RELEASE_WORKER=ios|android` e `FENIX_NATIVE_DISPATCH=0` sul runner:
  disattiva un secondo dispatch. `GITHUB_RUN_ID` è persistito come
  `workflowRunId` (l'intento resta `gha:<job>:<piattaforma>:native`).

Web resta nella Function Netlify.

## Locale

`FENIX_NATIVE_DISPATCH=0` (default fuori Netlify) esegue i comandi in-process
se Xcode/SDK sono installati. Su Netlify il default è un dispatch per
piattaforma. Fixture (`FENIX_RELEASE_FIXTURE=1`) non chiama store né worker.

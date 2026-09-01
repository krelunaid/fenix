import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StoredReleaseJob } from "./types.ts";

export function workDir(job: StoredReleaseJob, platform: "ios" | "android") {
  const root = process.env.FENIX_RELEASE_DIR || join(process.cwd(), ".grok/release");
  return join(root, "work", job.id, platform);
}

function xml(value: string): string {
  return Array.from(String(value || ""), (ch) => {
    if (ch === "&") return "\u0026amp;";
    if (ch === "<") return "\u0026lt;";
    if (ch === ">") return "\u0026gt;";
    if (ch === '"') return "\u0026quot;";
    return ch;
  }).join("");
}

export function materializeIos(job: StoredReleaseJob, teamId?: string): { root: string } {
  const root = workDir(job, "ios");
  const app = join(root, "Fenix");
  mkdirSync(app, { recursive: true });
  mkdirSync(join(root, "Fenix.xcodeproj"), { recursive: true });
  writeFileSync(join(app, "index.html"), job.html);
  writeFileSync(
    join(app, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${xml(job.config.bundleId)}</string>
<key>CFBundleName</key><string>${xml(job.config.appName)}</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
</dict></plist>
`,
  );
  writeFileSync(
    join(app, "App.swift"),
    `import UIKit
import WebKit
@main class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds)
    let vc = UIViewController(); let web = WKWebView(frame: window.bounds)
    if let url = Bundle.main.url(forResource: "index", withExtension: "html") { web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent()) }
    vc.view = web; window.rootViewController = vc; window.makeKeyAndVisible(); self.window = window
    return true
  }
}
`,
  );
  writeFileSync(
    join(root, "Fenix.xcodeproj", "project.pbxproj"),
    `// Generated Fenix iOS wrapper for ${job.config.bundleId}\n`,
  );
  writeFileSync(
    join(root, "ExportOptions.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store</string>
<key>signingStyle</key><string>automatic</string>
${teamId ? `<key>teamID</key><string>${xml(teamId)}</string>` : ""}
</dict></plist>
`,
  );
  return { root };
}

export function materializeAndroid(job: StoredReleaseJob): { root: string; aab: string } {
  const root = workDir(job, "android");
  const assets = join(root, "app/src/main/assets");
  mkdirSync(assets, { recursive: true });
  mkdirSync(join(root, "app/src/main/java/it/fenix/app"), { recursive: true });
  writeFileSync(join(assets, "index.html"), job.html);
  writeFileSync(
    join(root, "app/src/main/AndroidManifest.xml"),
    `<manifest package="${xml(job.config.packageName)}"><application android:label="${xml(job.config.appName)}"><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>`,
  );
  writeFileSync(
    join(root, "app/src/main/java/it/fenix/app/MainActivity.java"),
    `package it.fenix.app; import android.app.Activity; import android.os.Bundle; import android.webkit.WebView;
public class MainActivity extends Activity { @Override protected void onCreate(Bundle b){ super.onCreate(b); WebView w=new WebView(this); w.getSettings().setJavaScriptEnabled(true); w.loadUrl("file:///android_asset/index.html"); setContentView(w);} }`,
  );
  writeFileSync(
    join(root, "app/build.gradle"),
    `apply plugin: 'com.android.application'
android { namespace '${job.config.packageName}' compileSdk 35 defaultConfig { applicationId '${job.config.packageName}' minSdk 24 targetSdk 35 versionCode 1 versionName '1.0' } }
`,
  );
  writeFileSync(join(root, "settings.gradle"), "include ':app'\n");
  const aab = join(root, "app/build/outputs/bundle/release/app-release.aab");
  return { root, aab };
}

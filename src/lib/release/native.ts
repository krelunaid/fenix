import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { assignBuildNumbers } from "./build-id.ts";
import { installGradleWrapperJar } from "./gradle-wrapper.ts";
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

const IOS_IDS = {
  appSwiftBuild: "A10000000000000000000001",
  indexBuild: "A10000000000000000000002",
  appSwiftRef: "A10000000000000000000011",
  indexRef: "A10000000000000000000012",
  infoRef: "A10000000000000000000013",
  productRef: "A10000000000000000000020",
  sources: "A10000000000000000000030",
  resources: "A10000000000000000000031",
  frameworks: "A10000000000000000000032",
  fenixGroup: "A10000000000000000000040",
  productsGroup: "A10000000000000000000041",
  mainGroup: "A10000000000000000000042",
  target: "A100000000000000000000T0",
  project: "A100000000000000000000A0",
  targetCfgList: "A100000000000000000000C1",
  projectCfgList: "A100000000000000000000C0",
  targetDebug: "A100000000000000000000D1",
  targetRelease: "A100000000000000000000D2",
  projectDebug: "A100000000000000000000D3",
  projectRelease: "A100000000000000000000D4",
};

export function renderPbxproj(opts: {
  bundleId: string;
  teamId?: string;
  buildNumber: string;
  versionName: string;
}): string {
  const bundle = opts.bundleId;
  const team = opts.teamId ? `DEVELOPMENT_TEAM = ${opts.teamId};\n\t\t\t\t` : "";
  const build = opts.buildNumber;
  const version = opts.versionName;
  return `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {

/* Begin PBXBuildFile section */
		${IOS_IDS.appSwiftBuild} /* App.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${IOS_IDS.appSwiftRef} /* App.swift */; };
		${IOS_IDS.indexBuild} /* index.html in Resources */ = {isa = PBXBuildFile; fileRef = ${IOS_IDS.indexRef} /* index.html */; };
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		${IOS_IDS.appSwiftRef} /* App.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = App.swift; sourceTree = "<group>"; };
		${IOS_IDS.indexRef} /* index.html */ = {isa = PBXFileReference; lastKnownFileType = text.html; path = index.html; sourceTree = "<group>"; };
		${IOS_IDS.infoRef} /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
		${IOS_IDS.productRef} /* Fenix.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Fenix.app; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		${IOS_IDS.frameworks} /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		${IOS_IDS.mainGroup} = {
			isa = PBXGroup;
			children = (
				${IOS_IDS.fenixGroup} /* Fenix */,
				${IOS_IDS.productsGroup} /* Products */,
			);
			sourceTree = "<group>";
		};
		${IOS_IDS.fenixGroup} /* Fenix */ = {
			isa = PBXGroup;
			children = (
				${IOS_IDS.appSwiftRef} /* App.swift */,
				${IOS_IDS.infoRef} /* Info.plist */,
				${IOS_IDS.indexRef} /* index.html */,
			);
			path = Fenix;
			sourceTree = "<group>";
		};
		${IOS_IDS.productsGroup} /* Products */ = {
			isa = PBXGroup;
			children = (
				${IOS_IDS.productRef} /* Fenix.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		${IOS_IDS.target} /* Fenix */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = ${IOS_IDS.targetCfgList} /* Build configuration list for PBXNativeTarget "Fenix" */;
			buildPhases = (
				${IOS_IDS.sources} /* Sources */,
				${IOS_IDS.frameworks} /* Frameworks */,
				${IOS_IDS.resources} /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = Fenix;
			productName = Fenix;
			productReference = ${IOS_IDS.productRef} /* Fenix.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		${IOS_IDS.project} /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1500;
				LastUpgradeCheck = 1500;
				TargetAttributes = {
					${IOS_IDS.target} = {
						CreatedOnToolsVersion = 15.0;
					};
				};
			};
			buildConfigurationList = ${IOS_IDS.projectCfgList} /* Build configuration list for PBXProject "Fenix" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = ${IOS_IDS.mainGroup};
			productRefGroup = ${IOS_IDS.productsGroup} /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				${IOS_IDS.target} /* Fenix */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		${IOS_IDS.resources} /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				${IOS_IDS.indexBuild} /* index.html in Resources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		${IOS_IDS.sources} /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				${IOS_IDS.appSwiftBuild} /* App.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		${IOS_IDS.projectDebug} /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 16.0;
				SDKROOT = iphoneos;
			};
			name = Debug;
		};
		${IOS_IDS.projectRelease} /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 16.0;
				SDKROOT = iphoneos;
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
		${IOS_IDS.targetDebug} /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				${team}CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = ${build};
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = Fenix/Info.plist;
				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
				MARKETING_VERSION = ${version};
				PRODUCT_BUNDLE_IDENTIFIER = ${bundle};
				PRODUCT_NAME = Fenix;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		${IOS_IDS.targetRelease} /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				${team}CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = ${build};
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = Fenix/Info.plist;
				LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";
				MARKETING_VERSION = ${version};
				PRODUCT_BUNDLE_IDENTIFIER = ${bundle};
				PRODUCT_NAME = Fenix;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		${IOS_IDS.projectCfgList} /* Build configuration list for PBXProject "Fenix" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				${IOS_IDS.projectDebug} /* Debug */,
				${IOS_IDS.projectRelease} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		${IOS_IDS.targetCfgList} /* Build configuration list for PBXNativeTarget "Fenix" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				${IOS_IDS.targetDebug} /* Debug */,
				${IOS_IDS.targetRelease} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */
	};
	rootObject = ${IOS_IDS.project} /* Project object */;
}
`;
}

function renderScheme(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1500" version="1.7">
   <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
      <BuildActionEntries>
         <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${IOS_IDS.target}"
               BuildableName = "Fenix.app"
               BlueprintName = "Fenix"
               ReferencedContainer = "container:Fenix.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction buildConfiguration="Release" selectedDebuggerIdentifier="" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.PosixSpawn" shouldUseLaunchSchemeArgsEnv="YES">
      <Testables>
      </Testables>
   </TestAction>
   <LaunchAction buildConfiguration="Release" selectedDebuggerIdentifier="" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.PosixSpawn" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES">
      <BuildableProductRunnable runnableDebuggingMode="0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "${IOS_IDS.target}"
            BuildableName = "Fenix.app"
            BlueprintName = "Fenix"
            ReferencedContainer = "container:Fenix.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES">
      <BuildableProductRunnable runnableDebuggingMode="0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "${IOS_IDS.target}"
            BuildableName = "Fenix.app"
            BlueprintName = "Fenix"
            ReferencedContainer = "container:Fenix.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction buildConfiguration="Release">
   </AnalyzeAction>
   <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES">
   </ArchiveAction>
</Scheme>
`;
}

export type IosValidation = {
  root: string;
  pbxproj: string;
  bundleId: string;
  buildNumber: string;
};

export function validateIosProject(opts: IosValidation): { ok: true } | { ok: false; error: string } {
  const pbx = opts.pbxproj || "";
  if (/^\/\/[^\n]*\n?$/.test(pbx.trim()) || pbx.trim().split("\n").length < 8) {
    return { ok: false, error: "project.pbxproj e solo un commento. Serve un PBXNativeTarget." };
  }
  if (!/isa = PBXNativeTarget/.test(pbx)) {
    return { ok: false, error: "project.pbxproj senza PBXNativeTarget." };
  }
  if (!/isa = PBXFileReference/.test(pbx) || !/isa = PBXProject/.test(pbx)) {
    return { ok: false, error: "project.pbxproj incompleto (mancano file reference o project)." };
  }
  if (!/App\.swift/.test(pbx) || !/Info\.plist/.test(pbx) || !/index\.html/.test(pbx)) {
    return { ok: false, error: "project.pbxproj deve includere App.swift, Info.plist e index.html." };
  }
  const bundleRe = opts.bundleId.replace(/\./g, "\\.");
  if (!new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = ${bundleRe}`).test(pbx)) {
    return { ok: false, error: "PRODUCT_BUNDLE_IDENTIFIER non coincide con il bundle del job." };
  }
  if (opts.root) {
    if (!existsSync(join(opts.root, "Fenix", "App.swift"))) {
      return { ok: false, error: "Manca Fenix/App.swift." };
    }
    if (!existsSync(join(opts.root, "Fenix", "Info.plist"))) {
      return { ok: false, error: "Manca Fenix/Info.plist." };
    }
    if (!existsSync(join(opts.root, "Fenix", "index.html"))) {
      return { ok: false, error: "Manca Fenix/index.html." };
    }
    if (!existsSync(join(opts.root, "Fenix.xcodeproj", "xcshareddata", "xcschemes", "Fenix.xcscheme"))) {
      return { ok: false, error: "Manca lo scheme condiviso Fenix.xcscheme." };
    }
    try {
      const plist = readFileSync(join(opts.root, "Fenix", "Info.plist"), "utf8");
      if (!plist.includes(`<string>${opts.buildNumber}</string>`)) {
        return { ok: false, error: "CFBundleVersion non coincide con il build number persistito." };
      }
    } catch {
      return { ok: false, error: "Info.plist illeggibile." };
    }
  }
  return { ok: true };
}

export function materializeIos(job: StoredReleaseJob, teamId?: string): { root: string } {
  assignBuildNumbers(job);
  const root = workDir(job, "ios");
  const app = join(root, "Fenix");
  const proj = join(root, "Fenix.xcodeproj");
  const schemeDir = join(proj, "xcshareddata", "xcschemes");
  mkdirSync(app, { recursive: true });
  mkdirSync(schemeDir, { recursive: true });
  const build = job.config.iosBuildNumber || "1";
  const version = job.config.versionName || "1.0";
  writeFileSync(join(app, "index.html"), job.html);
  writeFileSync(
    join(app, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDevelopmentRegion</key><string>en</string>
<key>CFBundleExecutable</key><string>Fenix</string>
<key>CFBundleIdentifier</key><string>${xml(job.config.bundleId)}</string>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>CFBundleName</key><string>${xml(job.config.appName)}</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${xml(version)}</string>
<key>CFBundleVersion</key><string>${xml(build)}</string>
<key>LSRequiresIPhoneOS</key><true/>
<key>UILaunchScreen</key><dict/>
<key>UISupportedInterfaceOrientations</key>
<array><string>UIInterfaceOrientationPortrait</string></array>
</dict></plist>
`,
  );
  writeFileSync(
    join(app, "App.swift"),
    `import UIKit
import WebKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds)
    let vc = UIViewController()
    let web = WKWebView(frame: window.bounds)
    web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
      web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }
    vc.view = web
    window.rootViewController = vc
    window.makeKeyAndVisible()
    self.window = window
    return true
  }
}
`,
  );
  writeFileSync(
    join(proj, "project.pbxproj"),
    renderPbxproj({
      bundleId: job.config.bundleId,
      teamId,
      buildNumber: build,
      versionName: version,
    }),
  );
  writeFileSync(join(schemeDir, "Fenix.xcscheme"), renderScheme());
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

function packagePath(pkg: string): string {
  return pkg.split(".").join("/");
}

export type AndroidValidation = {
  root: string;
  packageName: string;
  versionCode: number;
  manifest: string;
  appGradle: string;
  mainActivity: string;
  mainActivityPath: string;
};

export function validateAndroidProject(
  opts: AndroidValidation,
): { ok: true } | { ok: false; error: string } {
  if (!opts.manifest.includes('xmlns:android="http://schemas.android.com/apk/res/android"')) {
    return { ok: false, error: "Il manifest manca xmlns:android." };
  }
  const pkg = opts.packageName;
  if (!opts.appGradle.includes("namespace '" + pkg + "'") && !opts.appGradle.includes('namespace "' + pkg + '"')) {
    return { ok: false, error: "namespace Gradle non coincide con il package del job." };
  }
  if (!opts.appGradle.includes("applicationId '" + pkg + "'") && !opts.appGradle.includes('applicationId "' + pkg + '"')) {
    return { ok: false, error: "applicationId non coincide con il package del job." };
  }
  if (!opts.mainActivity.includes("package " + pkg + ";")) {
    return { ok: false, error: "MainActivity package mismatch." };
  }
  const expected = join("java", packagePath(opts.packageName), "MainActivity.java");
  if (!opts.mainActivityPath.replace(/\\/g, "/").endsWith(expected)) {
    return { ok: false, error: "Percorso MainActivity non coincide con il package dinamico." };
  }
  if (opts.root && existsSync(opts.root)) {
    if (!existsSync(join(opts.root, "build.gradle"))) {
      return { ok: false, error: "Manca build.gradle di root." };
    }
    if (!existsSync(join(opts.root, "settings.gradle"))) {
      return { ok: false, error: "Manca settings.gradle." };
    }
    if (!existsSync(join(opts.root, "gradle/wrapper/gradle-wrapper.properties"))) {
      return { ok: false, error: "Manca Gradle wrapper." };
    }
  }
  if (opts.appGradle && !opts.appGradle.includes("versionCode " + String(opts.versionCode))) {
    return { ok: false, error: "versionCode non coincide con il valore persistito." };
  }
  return { ok: true };
}

const GRADLEW = `#!/bin/sh
APP_HOME=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
if [ -f "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" ]; then
  exec java -jar "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" "$@"
fi
if command -v gradle >/dev/null 2>&1; then
  exec gradle "$@"
fi
echo "Gradle wrapper jar assente e gradle non e nel PATH." >&2
exit 127
`;

export function materializeAndroid(job: StoredReleaseJob): { root: string; aab: string } {
  assignBuildNumbers(job);
  const root = workDir(job, "android");
  const pkg = job.config.packageName;
  const versionCode = job.config.androidVersionCode || 1;
  const versionName = job.config.versionName || "1.0";
  const javaDir = join(root, "app/src/main/java", packagePath(pkg));
  const assets = join(root, "app/src/main/assets");
  mkdirSync(assets, { recursive: true });
  mkdirSync(javaDir, { recursive: true });
  mkdirSync(join(root, "gradle/wrapper"), { recursive: true });
  writeFileSync(join(assets, "index.html"), job.html);
  writeFileSync(
    join(root, "app/src/main/AndroidManifest.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:label="${xml(job.config.appName)}" android:usesCleartextTraffic="true">
    <activity android:name="${xml(pkg)}.MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
`,
  );
  writeFileSync(
    join(javaDir, "MainActivity.java"),
    `package ${pkg};
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
public class MainActivity extends Activity {
  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    WebView w = new WebView(this);
    w.getSettings().setJavaScriptEnabled(true);
    w.loadUrl("file:///android_asset/index.html");
    setContentView(w);
  }
}
`,
  );
  writeFileSync(
    join(root, "app/build.gradle"),
    `plugins { id 'com.android.application' }
android {
  namespace '${pkg}'
  compileSdk 35
  defaultConfig {
    applicationId '${pkg}'
    minSdk 24
    targetSdk 35
    versionCode ${versionCode}
    versionName '${versionName}'
  }
  buildTypes { release { minifyEnabled false } }
}
`,
  );
  writeFileSync(
    join(root, "build.gradle"),
    `plugins { id 'com.android.application' version '8.6.1' apply false }
`,
  );
  writeFileSync(
    join(root, "settings.gradle"),
    `pluginManagement {
  repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories { google(); mavenCentral() }
}
rootProject.name = "Fenix"
include ':app'
`,
  );
  writeFileSync(
    join(root, "gradle.properties"),
    `android.useAndroidX=true
org.gradle.jvmargs=-Xmx2048m
`,
  );
  writeFileSync(
    join(root, "gradle/wrapper/gradle-wrapper.properties"),
    `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.7-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,
  );
  const gradlew = join(root, "gradlew");
  writeFileSync(gradlew, GRADLEW);
  try {
    chmodSync(gradlew, 0o755);
  } catch {
    /* windows */
  }
  try {
    installGradleWrapperJar(join(root, "gradle/wrapper"));
  } catch {
    /* vendor jar / network optional at materialize; worker uses setup-gradle */
  }
  const aab = join(root, "app/build/outputs/bundle/release/app-release.aab");
  mkdirSync(dirname(aab), { recursive: true });
  return { root, aab };
}

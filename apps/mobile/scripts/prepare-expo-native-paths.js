const fs = require("fs");
const path = require("path");

const appRoot = path.join(__dirname, "..");
const localVendorRoot = path.join(appRoot, "vendor-node_modules");
// Keep in sync with react-native.config.js and android/app/build.gradle.
// Windows uses a drive-root short path (MAX_PATH); Linux/EAS uses /tmp.
const shortVendorRoot =
  process.env.HOPLIO_NATIVE_VENDOR_ROOT ||
  (process.platform === "win32"
    ? path.join(process.env.SystemDrive || "C:", "hoplio-native")
    : path.join("/tmp", "hoplio-native"));
const shortVendorNodeModules = path.join(shortVendorRoot, "node_modules");
const expoPackageJsonPath = require.resolve("expo/package.json", {
  paths: [appRoot],
});
const packageTargets = new Map([
  ["expo-modules-core", localVendorRoot],
  ["@react-native-async-storage/async-storage", shortVendorRoot],
  ["@react-native-community/datetimepicker", shortVendorRoot],
  ["@react-native-community/netinfo", shortVendorRoot],
  ["@react-native-google-signin/google-signin", shortVendorRoot],
  ["react-native-get-random-values", shortVendorRoot],
  ["react-native-reanimated", shortVendorRoot],
  ["react-native-safe-area-context", shortVendorRoot],
  ["react-native-screens", shortVendorRoot],
  ["react-native-worklets", shortVendorRoot],
]);

if (shortVendorRoot !== localVendorRoot) {
  fs.mkdirSync(shortVendorRoot, { recursive: true });

  if (!fs.existsSync(shortVendorNodeModules)) {
    fs.symlinkSync(path.join(appRoot, "node_modules"), shortVendorNodeModules, "junction");
  }
}

for (const [packageName, targetRoot] of packageTargets) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [path.dirname(expoPackageJsonPath)],
  });
  const sourceDir = path.dirname(packageJsonPath);
  const targetDir = path.join(targetRoot, packageName);
  const sourcePackageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const targetPackageJsonPath = path.join(targetDir, "package.json");

  if (fs.existsSync(targetPackageJsonPath)) {
    try {
      const targetPackageJson = JSON.parse(
        fs.readFileSync(targetPackageJsonPath, "utf8"),
      );
      if (
        targetPackageJson.name === sourcePackageJson.name &&
        targetPackageJson.version === sourcePackageJson.version
      ) {
        console.log(`Reusing prepared native module copy for ${packageName}.`);
        continue;
      }
    } catch (error) {
      console.warn(`Refreshing ${packageName} after unreadable vendor copy.`);
    }
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });

  console.log(`Prepared short-path native module copy for ${packageName}.`);
}

const fs = require("fs");
const path = require("path");

const appRoot = path.join(__dirname, "..");
const expoPackageJsonPath = require.resolve("expo/package.json", {
  paths: [appRoot],
});
const packageNames = [
  "@react-native-async-storage/async-storage",
  "@react-native-community/datetimepicker",
  "@react-native-community/netinfo",
  "@react-native-google-signin/google-signin",
  "expo-modules-core",
  "react-native-get-random-values",
  "react-native-reanimated",
  "react-native-safe-area-context",
  "react-native-screens",
  "react-native-worklets",
];

for (const packageName of packageNames) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [path.dirname(expoPackageJsonPath)],
  });
  const sourceDir = path.dirname(packageJsonPath);
  const targetDir = path.join(__dirname, "..", "vendor-node_modules", packageName);

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });

  console.log(`Prepared short-path native module copy for ${packageName}.`);
}

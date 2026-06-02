const fs = require("fs");
const path = require("path");

const packageName = "expo-modules-core";
const packageJsonPath = require.resolve(`${packageName}/package.json`);
const sourceDir = path.dirname(packageJsonPath);
const targetDir = path.join(__dirname, "..", "vendor-node_modules", packageName);

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Prepared short-path native module copy for ${packageName}.`);

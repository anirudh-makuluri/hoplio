const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot, { isCSSEnabled: true });

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, "vendor-node_modules"),
	path.resolve(projectRoot, "node_modules"),
	path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;
config.resolver.unstable_enableSymlinks = true;

// Metro can't use the "react-native" export condition while package exports are
// disabled, so @firebase/auth resolves to dist/node on native and never registers auth.
const firebaseAuthRnEntry = path.resolve(
	projectRoot,
	'node_modules/@firebase/auth/dist/rn/index.js'
);
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName === '@firebase/auth' && platform !== 'web') {
		return context.resolveRequest(context, firebaseAuthRnEntry, platform);
	}

	if (defaultResolveRequest) {
		return defaultResolveRequest(context, moduleName, platform);
	}

	return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });

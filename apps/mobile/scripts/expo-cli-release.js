const path = require('path');

process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const expoPackageJson = require.resolve('expo/package.json', {
	paths: [path.join(__dirname, '..')],
});
const expoCliPackageJson = require.resolve('@expo/cli/package.json', {
	paths: [path.dirname(expoPackageJson)],
});

require(path.join(path.dirname(expoCliPackageJson), 'build', 'bin', 'cli'));

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// Expo CLI on Windows can crash on cached API responses ("Body has already been read")
// and on network fetches during dependency validation ("fetch failed").
process.env.EXPO_NO_CACHE = '1';
process.env.EXPO_NO_DEPENDENCY_VALIDATION = '1';

function runExpo(args) {
	const child = spawn('npx', ['expo', ...args], {
		cwd: projectRoot,
		stdio: 'inherit',
		shell: true,
		env: process.env,
	});

	child.on('exit', (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 0);
	});
}

const mode = process.argv[2];
const extraArgs = process.argv.slice(3);

if (mode === 'web') {
	runExpo(['start', '--web', ...extraArgs]);
} else if (mode === 'dev-client') {
	runExpo(['start', '--dev-client', ...extraArgs]);
} else {
	runExpo(['start', '--go', ...extraArgs]);
}

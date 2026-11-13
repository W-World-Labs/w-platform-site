import { execFile } from 'node:child_process';
import { chmod, constants, readFile, rm, writeFile, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const rootArgument = process.argv[process.argv.indexOf('--root') + 1];
const outputArgument = process.argv[process.argv.indexOf('--output') + 1];
if (!rootArgument || !outputArgument) throw new Error('protected checkout root and output required');
const pinFile = process.env.REFERENCE_HERMETIC_PINS_FILE || new URL('../contracts/reference-hermetic-pins.json', import.meta.url);
const pins = JSON.parse(await readFile(pinFile, 'utf8'));
if (pins.schema !== 'w-platform.reference-hermetic-pins/v1' || pins.status !== 'final') throw new Error('final hermetic pin manifest required');
await run(process.execPath, [new URL('./check-reference-hermetic-pins.mjs', import.meta.url).pathname], { env: process.env });
const root = resolve(rootArgument);
if (!root.includes(`${sep}production-reference${sep}`)) throw new Error('unsafe hermetic checkout root');
const output = resolve(outputArgument);
if (!output.startsWith(`${root}${sep}`)) throw new Error('unsafe hermetic descriptor output');
if (process.env.CARGO_HOME !== '/usr/local/cargo' || process.env.RUSTUP_HOME !== '/usr/local/rustup') throw new Error('protected Rust toolchain roots are invalid');
const denoBinary = resolve(process.env.W_DB_TEST_DENO_BINARY || '');
if (!denoBinary.startsWith(`${resolve(root, 'tools')}${sep}`)) throw new Error('protected Deno binary must be inside the run root');
const componentNames = ['w-id', 'w-db', 'w-storage', 'w-radar', 'w-monitor'];
const gitEnvironment = Object.fromEntries(Object.entries({ PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' }).filter(([, value]) => typeof value === 'string' && value));
const verifyEnvironment = Object.fromEntries(Object.entries({ PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG, LC_ALL: process.env.LC_ALL, TMPDIR: process.env.TMPDIR, CI: 'true', CARGO_HOME: process.env.CARGO_HOME, RUSTUP_HOME: process.env.RUSTUP_HOME, CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0', npm_config_userconfig: '/dev/null', npm_config_registry: 'https://registry.npmjs.org/', W_DB_TEST_DENO_BINARY: denoBinary }).filter(([, value]) => typeof value === 'string' && value));
const roots = {};
const expand = (part) => componentNames.reduce((value, name) => value.replaceAll(`{${name}}`, roots[name] || ''), part);
let stage = 'public-checkout';
try {
  for (const name of componentNames) {
    stage = `${name}-checkout`;
    const component = pins.components?.[name];
    if (!component || !/^[0-9a-f]{40}$/.test(component.commit || '')) throw new Error(`invalid final ${name} pin`);
    const destination = resolve(root, 'components', name);
    if (!destination.startsWith(`${root}${sep}`)) throw new Error('unsafe component destination');
    await run('git', ['clone', '--no-checkout', '--no-tags', component.repository, destination], { env: gitEnvironment, maxBuffer: 16 * 1024 * 1024 });
    await run('git', ['checkout', '--detach', component.commit], { cwd: destination, env: gitEnvironment, maxBuffer: 16 * 1024 * 1024 });
    const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd: destination, env: gitEnvironment });
    if (stdout.trim() !== component.commit) throw new Error(`${name} checkout provenance mismatch`);
    roots[name] = destination;
  }
  for (const name of componentNames) {
    const component = pins.components[name];
    for (const [index, template] of component.verify_commands.entries()) {
      stage = `${name}-verify-${index + 1}`;
      const command = template.map(expand);
      if (command.some((part) => !part || part.includes('{'))) throw new Error(`${name} verification command contains unresolved component roots`);
      await run(command[0], command.slice(1), { cwd: roots[name], env: verifyEnvironment, maxBuffer: 16 * 1024 * 1024 });
    }
    const { stdout } = await run('git', ['status', '--porcelain=v1', '--untracked-files=no'], { cwd: roots[name], env: gitEnvironment });
    if (stdout.trim()) throw new Error(`${name} verification modified tracked source`);
  }
  stage = 'launcher-resolution';
  const fixtureCommand = pins.components['w-id'].fixture_command.map(expand);
  const databaseLauncher = pins.components['w-db'].launcher_command.map(expand);
  const storageLauncher = pins.components['w-storage'].launcher_command.map(expand);
  const radarLauncher = pins.components['w-radar'].launcher_command.map(expand);
  const monitorLauncher = pins.components['w-monitor'].launcher_command.map(expand);
  const databaseBinary = resolve(roots['w-db'], 'target/debug/w-db');
  const storageBinary = resolve(roots['w-storage'], 'target/debug/w-storage');
  const radarBinary = resolve(roots['w-radar'], 'target/debug/w-radar-hermetic');
  const monitorBinary = resolve(roots['w-monitor'], 'w-monitor-server/target/debug/w-monitor-server');
  for (const binary of [databaseBinary, storageBinary, radarBinary, monitorBinary]) await access(binary, constants.X_OK);
  if ([...fixtureCommand, ...databaseLauncher, ...storageLauncher, ...radarLauncher, ...monitorLauncher].some((part) => !part || part.includes('{'))) throw new Error('fixture command contains unresolved component roots');
  await writeFile(output, `${JSON.stringify({ schema: 'w-platform.prepared-reference-fixture/v3', pins: Object.fromEntries(componentNames.map((name) => [name, pins.components[name].commit])), roots, fixture_command: fixtureCommand, database_launcher: databaseLauncher, storage_launcher: storageLauncher, radar_launcher: radarLauncher, monitor_launcher: monitorLauncher, database_binary: databaseBinary, storage_binary: storageBinary, radar_binary: radarBinary, monitor_binary: monitorBinary })}\n`, { mode: 0o600, flag: 'wx' });
  await chmod(output, 0o600);
} catch (error) {
  const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const result = typeof rawCode === 'number' || (typeof rawCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(rawCode)) ? `exit-${rawCode}` : 'exit-unavailable';
  await rm(resolve(root, 'components'), { recursive: true, force: true });
  throw new Error(`hermetic component preparation failed at ${stage} (${result}); child output suppressed`);
}

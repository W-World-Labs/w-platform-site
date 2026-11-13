import { readFile } from 'node:fs/promises';

const pins = JSON.parse(await readFile(process.env.REFERENCE_HERMETIC_PINS_FILE || new URL('../contracts/reference-hermetic-pins.json', import.meta.url), 'utf8'));
const allowPending = process.argv.includes('--allow-pending');
if (pins.schema !== 'w-platform.reference-hermetic-pins/v1' || !['pending', 'final'].includes(pins.status)) throw new Error('invalid reference pin manifest envelope');
const expected = {
  'w-id': ['w-reference-fixture/v1', 'w-reference-identity-private-lease/v3'],
  'w-db': ['w-db.reference-fixture/v1'],
  'w-storage': ['w-storage.reference-fixture/v1'],
  'w-radar': ['w-radar.reference-fixture/v1'],
  'w-monitor': ['w-monitor.reference-fixture/v1'],
};
if (JSON.stringify(Object.keys(pins.components || {}).sort()) !== JSON.stringify(Object.keys(expected).sort())) throw new Error('reference pin manifest component set mismatch');
for (const [name, schemas] of Object.entries(expected)) {
  const component = pins.components[name];
  if (pins.status === 'final' && component.repository !== `https://github.com/W-World-Labs/${name}.git`) throw new Error(`invalid ${name} public repository pin`);
  if (pins.status === 'pending' && ['repository', 'ref', 'commit', 'pull_request', 'provenance'].some((key) => component[key] !== null)) throw new Error(`pending ${name} must not masquerade as configured or reviewed`);
  const actualSchemas = Object.entries(component).filter(([key]) => key.endsWith('_schema')).map(([, value]) => value).sort();
  if (JSON.stringify(actualSchemas) !== JSON.stringify([...schemas].sort())) throw new Error(`invalid ${name} fixture schema pin`);
  if (pins.status === 'final' && !/^[0-9a-f]{40}$/.test(component.commit || '')) throw new Error(`final ${name} commit is not immutable`);
  if (pins.status === 'final' && component.ref !== 'refs/heads/main') throw new Error(`final ${name} ref is not protected main`);
  if (pins.status === 'final' && (!Number.isSafeInteger(component.pull_request) || component.pull_request < 1)) throw new Error(`final ${name} pull request provenance is unavailable`);
  if (pins.status === 'final' && (!component.provenance || JSON.stringify(Object.keys(component.provenance).sort()) !== JSON.stringify(['main_ci_run', 'main_ci_status', 'merge_commit']) || component.provenance.merge_commit !== component.commit || !Number.isSafeInteger(component.provenance.main_ci_run) || component.provenance.main_ci_run < 1 || component.provenance.main_ci_status !== 'SUCCESS')) throw new Error(`final ${name} reviewed-main provenance is unavailable`);
  if (pins.status === 'final' && (!Array.isArray(component.verify_commands) || !component.verify_commands.length || component.verify_commands.some((command) => !Array.isArray(command) || !command.length || command.some((part) => typeof part !== 'string' || !part)))) throw new Error(`final ${name} verify commands are unavailable`);
  if (pins.status === 'final' && name === 'w-id' && (!Array.isArray(component.fixture_command) || component.fixture_command.length < 1 || component.fixture_command.some((part) => typeof part !== 'string' || !part))) throw new Error('final W-ID fixture command is unavailable');
  if (name === 'w-id' && Object.hasOwn(component, 'otp_command')) throw new Error('legacy external OTP command must not be retained');
  if (pins.status === 'final' && name !== 'w-id' && (!Array.isArray(component.launcher_command) || !component.launcher_command.length || component.launcher_command.some((part) => typeof part !== 'string' || !part))) throw new Error(`final ${name} launcher command is unavailable`);
  if (pins.status === 'pending' && component.commit !== null) throw new Error(`pending ${name} must not masquerade as a final commit`);
}
if (pins.status !== 'final' && !allowPending) throw new Error('reference hermetic pins are not final');
process.stdout.write(`Reference hermetic pins ${pins.status === 'final' ? 'final and immutable' : 'honestly pending final reviewed heads'}.\n`);

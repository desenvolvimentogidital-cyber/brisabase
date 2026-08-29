const { access, copyFile, mkdir } = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const PROFILES = {
  hobby: {
    envFile: '.env.hobby',
    example: '.env.hobby.example',
    compose: ['docker-compose.local.yml', 'docker-compose.hobby.yml'],
    description: 'Local Docker stack for learning, prototypes and personal projects.',
  },
  'self-hosted': {
    envFile: '.env.production',
    example: '.env.production.example',
    compose: ['docker-compose.production.yml'],
    description: 'Single-host production stack for a VPS or dedicated server.',
  },
  enterprise: {
    envFile: '.env.enterprise',
    example: '.env.enterprise.example',
    compose: ['docker-compose.enterprise.yml'],
    description: 'External PostgreSQL/Redis/S3 enterprise topology with Docker application planes.',
  },
};

function fail(message) {
  process.stderr.write(`brisabase deployment: ${message}\n`);
  process.exitCode = 1;
}

function print(value) {
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
}

async function exists(file) {
  return access(path.join(root, file), constants.F_OK).then(() => true).catch(() => false);
}

function profile(name) {
  const selected = PROFILES[name || 'hobby'];
  if (!selected) throw new Error(`Unknown profile '${name}'. Use hobby, self-hosted, or enterprise.`);
  return { name: name || 'hobby', ...selected };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture ? String(result.stderr || result.stdout || '').trim() : '';
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}.`);
  }
  return result;
}

function dockerComposeArgs(selected, tail = []) {
  const args = ['compose', '--env-file', selected.envFile];
  for (const file of selected.compose) args.push('-f', file);
  args.push(...tail);
  return args;
}

async function init(selected) {
  if (await exists(selected.envFile)) {
    print({ profile: selected.name, envFile: selected.envFile, created: false, reason: 'already-exists' });
    return;
  }
  if (!await exists(selected.example)) throw new Error(`Missing ${selected.example}.`);
  await mkdir(path.dirname(path.join(root, selected.envFile)), { recursive: true });
  await copyFile(path.join(root, selected.example), path.join(root, selected.envFile), constants.COPYFILE_EXCL);
  print({
    profile: selected.name,
    envFile: selected.envFile,
    created: true,
    next: selected.name === 'hobby'
      ? `npm run deployment -- up ${selected.name}`
      : `Review ${selected.envFile}, replace all placeholders, then run npm run deployment -- doctor ${selected.name}`,
  });
}

async function doctor(selected) {
  if (!await exists(selected.envFile)) throw new Error(`${selected.envFile} was not found. Run npm run deployment -- init ${selected.name}.`);
  run('docker', ['version'], { capture: true });
  run('docker', ['compose', 'version'], { capture: true });
  run(process.execPath, ['scripts/validate-deployment-profile.cjs', selected.name, selected.envFile]);
  if (selected.name === 'self-hosted') {
    run(process.execPath, ['scripts/validate-production-env.cjs'], {
      env: { BRISABASE_ENV_FILE: selected.envFile },
    });
  }
  run('docker', dockerComposeArgs(selected, ['config', '--quiet']));
  print({ profile: selected.name, status: 'ready', envFile: selected.envFile, compose: selected.compose });
}

async function up(selected) {
  await doctor(selected);
  const args = dockerComposeArgs(selected, ['up', '-d']);
  if (selected.name !== 'enterprise') args.push('--build');
  run('docker', args);
  print({
    profile: selected.name,
    status: 'started',
    hint: selected.name === 'hobby'
      ? 'Open http://localhost:3000 after /health/required reports healthy.'
      : 'Use the APP_URL/API_URL configured for this profile.',
  });
}

async function down(selected) {
  if (!await exists(selected.envFile)) throw new Error(`${selected.envFile} was not found.`);
  run('docker', dockerComposeArgs(selected, ['down']));
  print({ profile: selected.name, status: 'stopped' });
}

async function status(selected) {
  if (!await exists(selected.envFile)) throw new Error(`${selected.envFile} was not found.`);
  run('docker', dockerComposeArgs(selected, ['ps']));
}

async function logs(selected) {
  if (!await exists(selected.envFile)) throw new Error(`${selected.envFile} was not found.`);
  run('docker', dockerComposeArgs(selected, ['logs', '--tail', '200', 'brisabase']));
}

function help() {
  print(`BrisaBase Deployment Profiles\n\nUsage:\n  npm run deployment -- init [hobby|self-hosted|enterprise]\n  npm run deployment -- doctor [profile]\n  npm run deployment -- up [profile]\n  npm run deployment -- down [profile]\n  npm run deployment -- status [profile]\n  npm run deployment -- logs [profile]\n\nProfiles:\n  hobby        Local Docker stack for beginners and prototypes\n  self-hosted  Single-server production deployment\n  enterprise   External PostgreSQL/Redis/S3 with Docker application planes`);
}

async function main() {
  const [command = 'help', name = 'hobby'] = process.argv.slice(2);
  if (command === 'help' || command === '--help' || command === '-h') return help();
  const selected = profile(name);
  if (command === 'init') return init(selected);
  if (command === 'doctor') return doctor(selected);
  if (command === 'up') return up(selected);
  if (command === 'down') return down(selected);
  if (command === 'status') return status(selected);
  if (command === 'logs') return logs(selected);
  throw new Error(`Unknown command '${command}'.`);
}

main().catch((error) => fail(error?.message || String(error)));

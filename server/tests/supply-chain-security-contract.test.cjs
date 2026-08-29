const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const ci = read('.github/workflows/brisabase-ci.yml');
const productionGate = read('.github/workflows/brisabase-production-gate.yml');
const windowsGate = read('.github/workflows/brisabase-windows-final-certification.yml');
const securityWorkflow = read('.github/workflows/brisabase-security.yml');
const dependabot = read('.github/dependabot.yml');
const dockerfile = read('Dockerfile');
const functionsDockerfile = read('Dockerfile.functions');
const sbom = read('scripts/generate-sbom.cjs');

for (const [name, workflow] of [
  ['CI', ci],
  ['Production Gate', productionGate],
  ['Windows Certification', windowsGate],
]) {
  assert.match(workflow, /actions\/checkout@v6/, `${name} must use checkout v6`);
  assert.match(workflow, /actions\/setup-node@v6/, `${name} must use setup-node v6`);
  assert.match(workflow, /persist-credentials:\s*false/, `${name} must not persist Git credentials`);
  assert.doesNotMatch(workflow, /actions\/checkout@v[1-5]/, `${name} must not regress checkout runtime`);
  assert.doesNotMatch(workflow, /actions\/setup-node@v[1-5]/, `${name} must not regress setup-node runtime`);
}

assert.match(ci, /permissions:\s*\n\s*contents:\s*read/);
assert.match(productionGate, /permissions:\s*\n\s*contents:\s*read/);
assert.match(windowsGate, /permissions:\s*\n\s*contents:\s*read/);

assert.match(securityWorkflow, /github\/codeql-action\/init@v4/);
assert.match(securityWorkflow, /languages:\s*javascript-typescript/);
assert.match(securityWorkflow, /queries:\s*security-extended/);
assert.match(securityWorkflow, /github\/codeql-action\/analyze@v4/);
assert.match(securityWorkflow, /actions\/dependency-review-action@v4/);
assert.match(securityWorkflow, /fail-on-severity:\s*high/);
assert.match(securityWorkflow, /npm audit --omit=dev --audit-level=high/);
assert.match(securityWorkflow, /generate-sbom\.cjs --output artifacts\/brisabase\.cdx\.json/);
assert.match(securityWorkflow, /actions\/upload-artifact@v4/);
assert.match(securityWorkflow, /security-events:\s*write/);
assert.doesNotMatch(securityWorkflow, /contents:\s*write/);

assert.match(dependabot, /package-ecosystem:\s*npm/);
assert.match(dependabot, /package-ecosystem:\s*github-actions/);
assert.match(dependabot, /interval:\s*weekly/g);

assert.match(sbom, /execFileSync\(npm, \['sbom', '--sbom-format', 'cyclonedx'\]/);
assert.match(sbom, /document\.bomFormat !== 'CycloneDX'/);
assert.match(sbom, /writeFileSync\(output/);

const runtimeSection = dockerfile.slice(dockerfile.indexOf('FROM ${NODE_RUNTIME_IMAGE} AS runtime'));
assert.match(runtimeSection, /USER node\s*\nCMD \["node", "dist\/server\/server\.cjs"\]/, 'production runtime must run as node user');
assert.match(functionsDockerfile, /USER node\s*\nCMD \["node", "dist\/server\/functions-executor\.cjs"\]/, 'Functions runtime must run as node user');

console.log('supply-chain-security-contract.test.cjs: ok');

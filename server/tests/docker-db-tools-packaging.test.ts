import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('Dockerfile', 'utf8');
const runtimeStage = dockerfile.slice(dockerfile.indexOf('FROM ${NODE_RUNTIME_IMAGE} AS runtime'), dockerfile.indexOf('FROM runtime AS integration'));

for (const tool of ['migrate.cjs', 'status.cjs', 'admin-create.cjs']) {
  const source = readFileSync(`server/db/${tool}`, 'utf8');
  assert.match(source, /require\('\.\/pg-ssl-options\.cjs'\)/, `${tool} must use the shared PostgreSQL TLS helper.`);
  assert.match(runtimeStage, new RegExp(`COPY --from=build \/app\/server\/db\/${tool.replace('.', '\\.')} \.\/server\/db\/${tool.replace('.', '\\.')}`), `${tool} must be packaged in the runtime image.`);
}

assert.match(
  runtimeStage,
  /COPY --from=build \/app\/server\/db\/pg-ssl-options\.cjs \.\/server\/db\/pg-ssl-options\.cjs/,
  'Runtime image must package pg-ssl-options.cjs beside the database operator tools that require it.',
);

console.log('Docker DB tools packaging contract passed.');

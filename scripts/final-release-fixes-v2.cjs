const fs = require('node:fs');

function replaceExact(path, before, after, label) {
  let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if (text.includes(after)) return false;
  if (!text.includes(before)) throw new Error(`Patch target not found in ${path}: ${label}`);
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log(`patched ${path}: ${label}`);
  return true;
}

replaceExact(
  'server/tests/production-config-contract.test.ts',
  "  ALERT_WEBHOOK_ENABLED: 'false', ALERT_WEBHOOK_URL: '', ALERT_WEBHOOK_TOKEN: '',\n};",
  "  ALERT_WEBHOOK_ENABLED: 'false', ALERT_WEBHOOK_URL: '', ALERT_WEBHOOK_TOKEN: '',\n  AI_PROVIDER_ALLOWED_HOSTS: 'api.openai.com',\n};",
  'include required AI provider allowlist in production fixture'
);

replaceExact(
  'server/config.ts',
  "    customDomainsEnabled: bool(process.env.HOSTING_CUSTOM_DOMAINS_ENABLED, production),",
  "    customDomainsEnabled: bool(process.env.HOSTING_CUSTOM_DOMAINS_ENABLED, false),",
  'make production custom domains explicit opt-in'
);

console.log('Production configuration alignment complete.');

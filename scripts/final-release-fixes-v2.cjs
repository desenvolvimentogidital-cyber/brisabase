const fs = require('node:fs');

// Apply the already-audited main release fixes first.
require('./final-release-fixes.cjs');

function replaceExact(path, before, after, label) {
  let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if (text.includes(after)) return;
  if (!text.includes(before)) throw new Error(`Patch target not found in ${path}: ${label}`);
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log(`patched ${path}: ${label}`);
}

// The real-app example was authored against the full browser/public SDK in
// src/sdk/brisaBaseClient.ts. Keep its package-style import boundary and map
// that alias to the canonical in-repo implementation during root typecheck.
replaceExact(
  'examples/real-app/src/App.tsx',
  "from '@brisabase/js';",
  "from '@brisabase/sdk';",
  'restore full SDK alias'
);

// Undo the temporary developer SDK dependency. It is a different, smaller SDK
// package and changing package.json without its lockfile would also break npm ci.
replaceExact(
  'examples/real-app/package.json',
  '  "dependencies": {\n    "@brisabase/js": "file:../../developer/sdk",\n    "react": "^19.0.1",',
  '  "dependencies": {\n    "react": "^19.0.1",',
  'keep real-app dependency manifest unchanged'
);

replaceExact(
  'tsconfig.json',
  '    "paths": {\n      "@/*": [\n        "./*"\n      ],\n      "@brisabase/js": [\n        "./developer/sdk/index.ts"\n      ]\n    },',
  '    "paths": {\n      "@/*": [\n        "./*"\n      ],\n      "@brisabase/sdk": [\n        "./src/sdk/brisaBaseClient.ts"\n      ]\n    },',
  'resolve real-app SDK alias to full in-repo client'
);

replaceExact(
  'server/tests/production-config-contract.test.ts',
  "  ALERT_WEBHOOK_ENABLED: 'false', ALERT_WEBHOOK_URL: '', ALERT_WEBHOOK_TOKEN: '',\n};",
  "  ALERT_WEBHOOK_ENABLED: 'false', ALERT_WEBHOOK_URL: '', ALERT_WEBHOOK_TOKEN: '',\n  AI_PROVIDER_ALLOWED_HOSTS: 'api.openai.com',\n};",
  'include required AI provider allowlist in production fixture'
);

console.log('Final release SDK and production fixture alignment complete.');

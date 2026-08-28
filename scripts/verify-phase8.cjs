const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>{if(!fs.existsSync(path.join(root,p)))throw new Error(`Missing ${p}`);};
const must=(p,needles)=>{const s=read(p);for(const n of needles)if(!s.includes(n))throw new Error(`${p} missing: ${n}`);};
for(const f of [
  'server/db/migrations/023_billing_enterprise_iac_phase8.sql','server/billing/localBillingEngine.ts','server/routes/billing.ts',
  'server/enterprise/enterpriseEngine.ts','server/routes/enterprise.ts','server/iac/iacEngine.ts','server/routes/iac.ts',
  'src/brisabase/pages/BillingPage.tsx','src/brisabase/pages/EnterprisePage.tsx','src/brisabase/services/enterpriseService.ts',
  'docs/legal/TERMS_TEMPLATE.md','docs/legal/PRIVACY_TEMPLATE.md','docs/SECURITY.md','docs/SUPPORT.md','docs/PRICING.md','docs/GO_LIVE_CHECKLIST.md',
  'PHASE8_COMPLETION.md'
]) exists(f);
const pkg=JSON.parse(read('package.json'));if(pkg.version!=='1.0.0')throw new Error(`Phase 8 release must be 1.0.0, got ${pkg.version}`);
const sdk=JSON.parse(read('developer/sdk/package.json'));if(sdk.version!==pkg.version)throw new Error('SDK version must match platform.');
if(!read('developer/cli/brisabase.mjs').includes(`const VERSION = '${pkg.version}'`))throw new Error('CLI version must match platform.');

must('server/db/migrations/023_billing_enterprise_iac_phase8.sql',[
  'billing_customers','billing_checkout_sessions','billing_refunds','billing_usage_ledger','enterprise_domains','enterprise_sso_connections',
  'enterprise_scim_tokens','enterprise_ip_allowlist','enterprise_policies','enterprise_siem_sinks','compliance_evidence','enterprise_roles','iac_exports'
]);
must('server/billing/localBillingEngine.ts',[
  "const stripeApiBase='https://api.stripe.com/v1'",'Idempotency-Key','createCheckout','createPortal','cancelSubscription','verifyStripeWebhook',
  'applyStripeEvent','billing_usage_ledger','assertEnterpriseAccess','overageEnabled','automatic_tax[enabled]','FOR UPDATE','billing_refunds'
]);
must('server/routes/billing.ts',['express.raw','stripe-signature','/api/billing/checkout','/api/billing/portal','/api/billing/invoices/:invoiceId/refund']);
must('server/middleware/auth.ts',["return 'billing'",'customRoleAllows','assertEnterpriseAccess','IP_NOT_ALLOWED','SSO_REQUIRED','ADMIN_MFA_REQUIRED']);

must('server/enterprise/enterpriseEngine.ts',[
  'resolveTxt','publicHttps','privateIp','encryptSecret','decryptSecret','enterprise_scim_tokens','token_hash','enterprise_ip_allowlist',
  'enterprise_policies','enterprise_siem_sinks','Compliance Center provides technical evidence and does not constitute legal certification.',
  'code_challenge_method','S256','profile.email_verified!==true','SAML gateway assertion signature is invalid.','JIT provisioning is disabled',
  'customRoleAllows','cidrContains'
]);
must('server/routes/enterprise.ts',['/api/enterprise/domains','/api/enterprise/sso','/api/enterprise/scim/tokens','/api/enterprise/ip-allowlist','/api/enterprise/roles','/api/enterprise/siem','/api/enterprise/compliance','/enterprise/v1/sso/:id/start','/scim/v2']);

must('server/iac/iacEngine.ts',["filter(key=>key!=='generatedAt')",'manifest_sha256','terraform_data','iac_exports','public async diff','differences.slice(0,500)']);
must('developer/cli/brisabase.mjs',['iac export','iac diff','iac check','iac history',"key !== 'generatedAt'",'BRISABASE_TOKEN']);
must('server/routes/iac.ts',['/api/iac/export','/api/iac/history','/api/iac/diff']);

must('scripts/validate-production-env.cjs',['BILLING_PROVIDER','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_PRO','STRIPE_PRICE_TEAM']);
must('.env.production.example',['BRISABASE_RELEASE=1.0.0','BILLING_PROVIDER=disabled','STRIPE_SECRET_KEY=','ENTERPRISE_ENABLED=true']);
must('docker-compose.production.yml',['BILLING_PROVIDER:','STRIPE_SECRET_KEY:','STRIPE_WEBHOOK_SECRET:','ENTERPRISE_ENABLED:']);
must('src/App.tsx',['<EnterprisePage />','path="/billing"']);
must('src/components/layout/Sidebar.tsx',["path: '/enterprise'","path: '/billing'"]);
must('src/brisabase/pages/BillingPage.tsx',['Checkout, assinatura, uso, invoices e refunds','BILLING_PROVIDER=stripe','Refund']);
must('src/brisabase/pages/EnterprisePage.tsx',['Enterprise SSO','SCIM','IP allowlist','RBAC customizado','SIEM','Compliance Center','Infrastructure as Code']);
must('src/brisabase/pages/DeveloperPlatformPage.tsx',['Release" value="1.0.0','BrisaBase CLI 1.0.0']);
must('developer/packages/manifest.ts',["version: '1.0.0'"]);
must('developer/sdk/generator.ts',["version = '1.0.0'"]);
must('.env.production.example',['FUNCTIONS_IMAGE=ghcr.io/example/brisabase-functions:1.0.0@sha256:']);

const migrations=fs.readdirSync(path.join(root,'server/db/migrations')).filter(f=>/^\d+_.+\.sql$/.test(f));const prefixes=migrations.map(f=>f.split('_')[0]);if(new Set(prefixes).size!==prefixes.length)throw new Error('Migration numeric prefixes must be unique.');
if(!migrations.includes('023_billing_enterprise_iac_phase8.sql'))throw new Error('Phase 8 migration is missing from migration sequence.');

const docs=['docs/legal/TERMS_TEMPLATE.md','docs/legal/PRIVACY_TEMPLATE.md'];for(const d of docs){const s=read(d);if(!/legal review|revis[aã]o jur[ií]dica/i.test(s))throw new Error(`${d} must explicitly require legal review before publication.`);}
if(!read('docs/GO_LIVE_CHECKLIST.md').includes('npm run phase8:verify'))throw new Error('Go-live checklist must include phase8 verification.');
console.log('Phase 8 verification: PASS');

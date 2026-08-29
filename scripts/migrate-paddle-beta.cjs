/* eslint-disable no-console */
const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');
const replaceRequired = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`Expected source fragment missing: ${label}`);
  return text.replace(from, to);
};

// Runtime production configuration.
{
  const file = 'server/config.ts';
  let text = read(file);
  text = replaceRequired(text, "    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',", "    paddleApiKey: process.env.PADDLE_API_KEY || '',", 'config Stripe API key');
  text = replaceRequired(text, "    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',", "    paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET || '',", 'config Stripe webhook');
  text = replaceRequired(text, "    automaticTax: bool(process.env.STRIPE_AUTOMATIC_TAX, false),", "    paddleEnvironment: (process.env.PADDLE_ENVIRONMENT || 'sandbox').toLowerCase(),", 'config Stripe automatic tax');
  const start = text.indexOf("    if (!['disabled','stripe'].includes(config.billing.provider))");
  const end = text.indexOf('\n\n    if (config.functions.enabled)', start);
  if (start < 0 || end < 0) throw new Error('Billing production validation block not found in server/config.ts');
  const block = [
    "    if (!['disabled','paddle'].includes(config.billing.provider)) throw new Error('[BRISABASE CONFIGURATION ERROR] BILLING_PROVIDER must be disabled or paddle.');",
    "    if (!['sandbox','live'].includes(config.billing.paddleEnvironment)) throw new Error('[BRISABASE CONFIGURATION ERROR] PADDLE_ENVIRONMENT must be sandbox or live.');",
    "    if (config.billing.provider === 'paddle') {",
    "      secureSecret('PADDLE_API_KEY', process.env.PADDLE_API_KEY);",
    "      secureSecret('PADDLE_WEBHOOK_SECRET', process.env.PADDLE_WEBHOOK_SECRET);",
    "      required('PADDLE_PRICE_PRO', process.env.PADDLE_PRICE_PRO);",
    "      required('PADDLE_PRICE_TEAM', process.env.PADDLE_PRICE_TEAM);",
    "      const paddleKey = String(process.env.PADDLE_API_KEY || '');",
    "      const expectedPrefix = config.billing.paddleEnvironment === 'live' ? 'pdl_live_apikey_' : 'pdl_sdbx_apikey_';",
    "      if (!paddleKey.startsWith(expectedPrefix)) throw new Error(`[BRISABASE CONFIGURATION ERROR] PADDLE_API_KEY must match PADDLE_ENVIRONMENT=${config.billing.paddleEnvironment}.`);",
    "      if (!String(process.env.PADDLE_WEBHOOK_SECRET || '').startsWith('pdl_ntfset_')) throw new Error('[BRISABASE CONFIGURATION ERROR] PADDLE_WEBHOOK_SECRET must be a Paddle notification destination secret.');",
    "      if (!String(process.env.PADDLE_PRICE_PRO || '').startsWith('pri_')) throw new Error('[BRISABASE CONFIGURATION ERROR] PADDLE_PRICE_PRO must be a Paddle price id.');",
    "      if (!String(process.env.PADDLE_PRICE_TEAM || '').startsWith('pri_')) throw new Error('[BRISABASE CONFIGURATION ERROR] PADDLE_PRICE_TEAM must be a Paddle price id.');",
    '    }',
  ].join('\n');
  text = text.slice(0, start) + block + text.slice(end);
  write(file, text);
}

// Standalone production-env validator.
{
  const file = 'scripts/validate-production-env.cjs';
  let text = read(file);
  const start = text.indexOf("const billingProvider = String(env.BILLING_PROVIDER || 'disabled').toLowerCase();");
  const end = text.indexOf('\n\nif (env.COOKIE_SECURE', start);
  if (start < 0 || end < 0) throw new Error('Billing validation block not found in validate-production-env.cjs');
  const block = [
    "const billingProvider = String(env.BILLING_PROVIDER || 'disabled').toLowerCase();",
    "const paddleEnvironment = String(env.PADDLE_ENVIRONMENT || 'sandbox').toLowerCase();",
    "if (!['disabled','paddle'].includes(billingProvider)) failures.push('BILLING_PROVIDER must be disabled or paddle');",
    "if (!['sandbox','live'].includes(paddleEnvironment)) failures.push('PADDLE_ENVIRONMENT must be sandbox or live');",
    "if (billingProvider === 'paddle') {",
    "  for (const name of ['PADDLE_API_KEY','PADDLE_WEBHOOK_SECRET','PADDLE_PRICE_PRO','PADDLE_PRICE_TEAM']) required(name);",
    "  const expectedPrefix = paddleEnvironment === 'live' ? 'pdl_live_apikey_' : 'pdl_sdbx_apikey_';",
    "  if (!String(env.PADDLE_API_KEY || '').startsWith(expectedPrefix) || weak(env.PADDLE_API_KEY)) failures.push(`PADDLE_API_KEY must be a non-placeholder ${paddleEnvironment} Paddle API key with at least 32 bytes`);",
    "  if (!String(env.PADDLE_WEBHOOK_SECRET || '').startsWith('pdl_ntfset_') || weak(env.PADDLE_WEBHOOK_SECRET)) failures.push('PADDLE_WEBHOOK_SECRET must be a non-placeholder Paddle notification destination secret with at least 32 bytes');",
    "  if (env.PADDLE_PRICE_PRO && !String(env.PADDLE_PRICE_PRO).startsWith('pri_')) failures.push('PADDLE_PRICE_PRO must be a Paddle price id');",
    "  if (env.PADDLE_PRICE_TEAM && !String(env.PADDLE_PRICE_TEAM).startsWith('pri_')) failures.push('PADDLE_PRICE_TEAM must be a Paddle price id');",
    '}',
  ].join('\n');
  text = text.slice(0, start) + block + text.slice(end);
  write(file, text);
}

// Environment templates. Billing is intentionally disabled for public beta.
{
  const block = [
    '# Phase 8 — commercial billing.',
    '# Public beta stays free with BILLING_PROVIDER=disabled.',
    '# After validation, use Paddle sandbox first, then switch to live credentials.',
    'BILLING_PROVIDER=disabled',
    'PADDLE_ENVIRONMENT=sandbox',
    'PADDLE_API_KEY=',
    'PADDLE_WEBHOOK_SECRET=',
    'PADDLE_PRICE_PRO=',
    'PADDLE_PRICE_TEAM=',
    'PADDLE_PRICE_ENTERPRISE=',
    'ENTERPRISE_ENABLED=true',
  ].join('\n');
  for (const file of ['.env.production.example','.env.homologation.example','.env.enterprise.example','.env.hobby.example','.env.example']) {
    if (!fs.existsSync(file)) continue;
    let text = read(file);
    const marker = '# Phase 8 — commercial billing';
    if (!text.includes(marker)) continue;
    const start = text.indexOf(marker);
    const ent = text.indexOf('ENTERPRISE_ENABLED=true', start);
    if (ent < 0) throw new Error(`ENTERPRISE_ENABLED marker missing in ${file}`);
    const end = ent + 'ENTERPRISE_ENABLED=true'.length;
    text = text.slice(0, start) + block + text.slice(end);
    write(file, text);
  }
}

// Public beta policy.
write('docs/BETA_POLICY.md', `# Política do beta BrisaBase

## Estado de lançamento

O BrisaBase pode operar como **beta público gratuito** quando os gates técnicos do mesmo SHA estiverem verdes e os itens legais e operacionais aplicáveis do \`docs/GO_LIVE_CHECKLIST.md\` estiverem aprovados. Durante essa fase, cadastro público pode ser habilitado, mas cobrança real permanece bloqueada.

## Compromissos do beta público gratuito

- disponibilidade e suporte em melhor esforço, sem SLA;
- \`BILLING_PROVIDER=disabled\` obrigatório no beta e nenhuma cobrança real;
- Paddle é o provedor comercial planejado, mas credenciais, checkout e webhooks live permanecem inativos até validação dos objetivos do beta;
- somente releases identificadas por tag imutável e aprovadas no mesmo SHA pelo **BrisaBase Production Gate**;
- registro de SBOM, manifesto SHA-256, imagens por digest e evidências de teste por candidato;
- incidentes de segurança enviados por Security Advisory privado;
- mudanças incompatíveis e limitações conhecidas descritas nas notas de release.

## Limitações conhecidas

- Self-Hosted é single-host e não oferece HA por si só;
- PITR e restore parcial dependem do provedor/infraestrutura e de certificação operacional;
- Functions Enterprise exige executor externo isolado quando habilitado;
- SDKs marcados como \`preview\` não possuem garantia de estabilidade;
- o beta não deve receber dados sensíveis, regulados ou cuja perda cause impacto material.

## Critério para ativar cobrança

A cobrança só pode ser ativada depois que os objetivos do beta forem validados e pricing, impostos, cancelamento, refunds, suporte e operação estiverem aprovados. A ativação deve ocorrer primeiro em Paddle Sandbox e só depois com credenciais Paddle Live.
`);

{
  const file = 'docs/GO_LIVE_CHECKLIST.md';
  let text = read(file);
  text = replaceRequired(text, '- [ ] modo `disabled` ou Stripe escolhido explicitamente;', '- [ ] beta público: `BILLING_PROVIDER=disabled` confirmado; ativação futura: `paddle`;', 'go-live billing mode');
  text = replaceRequired(text, '- [ ] webhook Stripe registrado no endpoint bruto da release;', '- [ ] antes de cobrança real, webhook Paddle registrado em `/billing/v1/paddle/webhook` e assinatura validada;', 'go-live webhook');
  text = replaceRequired(text, '- [ ] checkout/portal/invoice/refund testados em ambiente Stripe de teste antes de live keys;', '- [ ] checkout/portal/subscription/transaction/refund testados em Paddle Sandbox antes de credenciais Live;', 'go-live provider tests');
  write(file, text);
}

write('docs/PRICING.md', `# Pricing — estado do beta

A implementação contém quatro tiers técnicos: **Free, Pro, Team e Enterprise**. Durante o beta público, \`BILLING_PROVIDER=disabled\` é obrigatório e os valores exibidos são referências técnicas, não uma oferta comercial. Checkout, cobrança e overage pagos permanecem desativados até a validação dos objetivos do beta.

- **Free**: plano efetivo do beta público, sem cobrança externa.
- **Pro**: referência para futura cobrança recorrente e limites ampliados.
- **Team**: referência para futura colaboração e limites maiores.
- **Enterprise**: referência para limites contratuais, SSO, SCIM, SIEM, políticas e suporte negociado.

Quando \`BILLING_PROVIDER=disabled\`, o BrisaBase opera sem processamento externo de pagamentos. A integração comercial planejada é Paddle. Depois do beta, a ativação segue \`PADDLE_ENVIRONMENT=sandbox\` para homologação e só então \`PADDLE_ENVIRONMENT=live\` com credenciais Live.

O BrisaBase não armazena dados completos de cartão. Checkout e portal de cliente são hospedados pelo provedor. Pricing, impostos, ciclo, cancelamento, reembolso, limites, tratamento de excedentes e canal de suporte devem ser aprovados antes de cobrança real.
`);

// Phase 8 static contract follows the provider migration.
{
  const file = 'server/tests/billing-enterprise-iac-phase8-contract.test.cjs';
  let text = read(file);
  const changes = [
    ["assert(billingRoutes.includes(\"express.raw({type:'application/json'\"),'Stripe webhook must receive raw bytes');", "assert(billingRoutes.includes(\"/billing/v1/paddle/webhook\")&&billingRoutes.includes(\"express.raw({type:'application/json'\"),'Paddle webhook must receive raw bytes');"],
    ["assert(billing.includes(\"crypto.createHmac('sha256',secret)\"),'Stripe webhook signature verification missing');", "assert(billing.includes(\"crypto.createHmac('sha256',secret)\")&&billing.includes(\"`${timestamp}:${rawBody.toString('utf8')}`\"),'Paddle webhook signature verification missing');"],
    ["assert(billing.includes('timingSafeHex'),'Stripe webhook signature compare must be timing-safe');", "assert(billing.includes('timingSafeHex'),'Paddle webhook signature compare must be timing-safe');"],
    ["assert(billing.includes(\"redirect:'error'\")&&billing.includes('AbortSignal.timeout(20_000)'),'Stripe calls must reject redirects and have timeouts');", "assert(billing.includes(\"redirect:'error'\")&&billing.includes('AbortSignal.timeout(20_000)'),'Paddle calls must reject redirects and have timeouts');"],
    ["assert(billing.includes(\"'Idempotency-Key':idempotencyKey\"),'Stripe writes must support idempotency keys');", "assert(billing.includes('String(event.event_id)')&&billing.includes('ON CONFLICT(id) DO NOTHING'),'Paddle webhook processing must deduplicate event ids');"],
    ["assert(validator.includes(\"BILLING_PROVIDER must be disabled or stripe\"),'billing provider allowlist missing');", "assert(validator.includes(\"BILLING_PROVIDER must be disabled or paddle\"),'billing provider allowlist missing');"],
    ["assert(validator.includes('STRIPE_WEBHOOK_SECRET')&&validator.includes(\"startsWith('whsec_')\"),'Stripe signing secret validation missing');", "assert(validator.includes('PADDLE_WEBHOOK_SECRET')&&validator.includes(\"startsWith('pdl_ntfset_')\"),'Paddle signing secret validation missing');"],
    ["assert(validator.includes('STRIPE_PRICE_PRO')&&validator.includes('STRIPE_PRICE_TEAM'),'paid plan price configuration validation missing');", "assert(validator.includes('PADDLE_PRICE_PRO')&&validator.includes('PADDLE_PRICE_TEAM'),'paid plan price configuration validation missing');"],
  ];
  for (const [from,to] of changes) text = replaceRequired(text, from, to, `phase8: ${from.slice(0,50)}`);
  text = replaceRequired(text, "console.log('Billing + Enterprise + IaC Phase 8 contract: PASS');", "assert(!billing.includes('STRIPE_')&&!billingRoutes.includes('/stripe/'),'Stripe billing references must be removed from the runtime');\nconsole.log('Billing + Enterprise + IaC Phase 8 contract: PASS');", 'phase8 final assertion');
  write(file, text);
}

console.log('Paddle beta migration source edits completed.');

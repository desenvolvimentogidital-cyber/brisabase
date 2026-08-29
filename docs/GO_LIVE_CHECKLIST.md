# BrisaBase 1.0.1-beta.1 — Go-Live Checklist

## Código e regressão
- [ ] `npm run phase8:verify`
- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:browser`
- [ ] `npm run release:manifest:verify`
- [ ] `npm run release:validate:docker`

## Produção
- [ ] `BRISABASE_ENV_FILE=.env.production npm run production:validate`
- [ ] imagens imutáveis e secrets únicos;
- [ ] DNS/TLS/custom domains validados;
- [ ] backup automático executado e restore drill aprovado;
- [ ] PITR testado quando habilitado;
- [ ] alertas, status page e on-call definidos;
- [ ] quotas/usage verificados com o plano esperado.

## Billing
- [ ] beta público: `BILLING_PROVIDER=disabled` confirmado; ativação futura: `paddle`;
- [ ] antes de cobrança real, webhook Paddle registrado em `/billing/v1/paddle/webhook` e assinatura validada;
- [ ] checkout/portal/subscription/transaction/refund testados em Paddle Sandbox antes de credenciais Live;
- [ ] pricing, impostos, cancelamento e política de refunds aprovados comercial/juridicamente.

## Enterprise
- [ ] domínio DNS verificado;
- [ ] OIDC/SAML Gateway testado com conta não privilegiada;
- [ ] SCIM testado para create/update/disable de usuários e grupos;
- [ ] IP allowlist testada com procedimento de break-glass;
- [ ] SIEM testado e segredos rotacionados;
- [ ] Compliance Center revisado como evidência técnica, não certificação.

## Legal e suporte
- [ ] Termos e Política de Privacidade revisados por jurídico;
- [ ] subprocessadores reais documentados;
- [ ] habilitar Private Vulnerability Reporting e publicar o `security.txt` já versionado;
- [ ] suporte/on-call e matriz de severidade aprovados.

## Git e release
- [ ] nova tag beta criada após o runner final verde no mesmo SHA;
- [ ] commit/release imutável publicado;
- [ ] SBOM, pacotes, digests, logs, traces e manifesto SHA-256 arquivados;
- [ ] rollback da aplicação e do banco documentado/testado.

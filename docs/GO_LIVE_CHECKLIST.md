# BrisaBase 1.0 — Go-Live Checklist

## Código e regressão
- [ ] `npm run phase8:verify`
- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:browser`
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
- [ ] modo `disabled` ou Stripe escolhido explicitamente;
- [ ] webhook Stripe registrado no endpoint bruto da release;
- [ ] checkout/portal/invoice/refund testados em ambiente Stripe de teste antes de live keys;
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
- [ ] canal de segurança e `security.txt` publicados;
- [ ] suporte/on-call e matriz de severidade aprovados.

## Git e release
- [ ] tag `v1.0.0` criada após o runner final verde;
- [ ] commit/release imutável publicado;
- [ ] artefato e manifesto SHA-256 arquivados;
- [ ] rollback da aplicação e do banco documentado/testado.

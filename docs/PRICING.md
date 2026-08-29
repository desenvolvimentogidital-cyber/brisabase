# Pricing — estado do beta

A implementação contém quatro tiers técnicos: **Free, Pro, Team e Enterprise**. Durante o beta fechado, `BILLING_PROVIDER=disabled` é obrigatório e os valores exibidos são referências técnicas, não uma oferta comercial. Checkout, cobrança, overage e chaves Stripe não devem ser habilitados até aprovação comercial, tributária, jurídica e operacional.

- **Free**: limites rígidos e sem overage.
- **Pro**: cobrança recorrente, limites ampliados e overage.
- **Team**: colaboração e limites maiores com overage.
- **Enterprise**: limites contratuais, SSO, SCIM, SIEM, políticas e suporte negociado.

Quando `BILLING_PROVIDER=disabled`, a instalação self-hosted opera sem processamento externo de pagamentos. Quando `BILLING_PROVIDER=stripe`, checkout, portal, invoices, cancelamento, impostos automáticos e refunds usam Stripe; dados completos de cartão não são armazenados no BrisaBase.

Cadastro público ou cobrança real exigem uma tabela comercial aprovada com moeda, impostos, ciclo, cancelamento, reembolso, limites, tratamento de excedentes e canal de suporte. Até lá, a política pública aplicável é `docs/BETA_POLICY.md`.

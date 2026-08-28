# Pricing — BrisaBase 1.0

A implementação contém quatro tiers técnicos: **Free, Pro, Team e Enterprise**. Os valores e limites exibidos no produto devem ser revisados comercialmente antes do lançamento.

- **Free**: limites rígidos e sem overage.
- **Pro**: cobrança recorrente, limites ampliados e overage.
- **Team**: colaboração e limites maiores com overage.
- **Enterprise**: limites contratuais, SSO, SCIM, SIEM, políticas e suporte negociado.

Quando `BILLING_PROVIDER=disabled`, a instalação self-hosted opera sem processamento externo de pagamentos. Quando `BILLING_PROVIDER=stripe`, checkout, portal, invoices, cancelamento, impostos automáticos e refunds usam Stripe; dados completos de cartão não são armazenados no BrisaBase.

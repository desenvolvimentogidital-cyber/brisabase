# Política do beta BrisaBase

## Estado de lançamento

Enquanto os itens legais e operacionais do `docs/GO_LIVE_CHECKLIST.md` não estiverem aprovados, o BrisaBase deve operar somente como **beta fechado**, com participantes convidados e dados não críticos. Cadastro público aberto e cobrança real permanecem bloqueados.

## Compromissos do beta fechado

- disponibilidade e suporte em melhor esforço, sem SLA;
- `BILLING_PROVIDER=disabled` por padrão e nenhuma cobrança real;
- somente releases identificadas por tag imutável e aprovadas no mesmo SHA pelo **BrisaBase Production Gate**;
- registro de SBOM, manifesto SHA-256, imagens por digest e evidências de teste por candidato;
- incidentes de segurança enviados por Security Advisory privado;
- mudanças incompatíveis e limitações conhecidas descritas nas notas de release.

## Limitações conhecidas

- Self-Hosted é single-host e não oferece HA por si só;
- PITR e restore parcial dependem do provedor/infraestrutura e de certificação operacional;
- Functions Enterprise exige executor externo isolado quando habilitado;
- SDKs marcados como `preview` não possuem garantia de estabilidade;
- o beta não deve receber dados sensíveis, regulados ou cuja perda cause impacto material.

## Critério para abrir o cadastro

O cadastro público só pode ser ativado quando licença, Termos, Privacidade, subprocessadores, canal de privacidade, suporte, on-call, alertas, restore, rollback, painéis de segurança e checklist de produção estiverem aprovados por responsáveis identificados.

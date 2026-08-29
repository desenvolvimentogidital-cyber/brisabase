# Processo de release beta

## Candidato

1. Integre mudanças na `main` exclusivamente por pull request protegido.
2. Atualize `SOURCE_SHA256SUMS.txt` com `npm run release:manifest:generate` e confirme com `npm run release:manifest:verify`.
3. Aguarde CI, CodeQL e **BrisaBase Production Gate** verdes no mesmo SHA.
4. Baixe `brisabase-release-evidence-<sha>` do gate e preserve o SBOM, manifesto, identidade do commit, lista de imagens, logs, traces e pacotes do CLI/SDK.
5. Confirme os painéis de segurança e todos os itens humanos/externos do `docs/GO_LIVE_CHECKLIST.md`.

## Publicação

Crie uma nova tag beta anotada e imutável; não mova nem substitua `v1.0.0`. Use uma versão posterior, por exemplo `v1.0.1-beta.1`, desde que coincida com as versões dos pacotes que serão distribuídos.

Publique uma GitHub Release para a tag e anexe:

- `SOURCE_SHA256SUMS.txt`;
- `RELEASE_SHA256SUMS.txt`;
- `brisabase.cdx.json`;
- `release-evidence.json`;
- `container-images.txt`;
- tarballs aprovados do CLI e SDK;
- notas com limitações, migração e rollback.

Registre na release o link do Production Gate verde. Se qualquer artefato for reconstruído, ele constitui um novo candidato e exige novo gate e nova versão.

## Instalação beta do CLI e SDK

Durante o beta fechado, os tarballs do gate/release são o canal oficial; o pacote raiz continua privado e não deve ser publicado por acidente.

```bash
npm install --global ./brisabase-cli-<version>.tgz
npm install ./brisabase-js-<version>.tgz
```

Compare os tarballs com `RELEASE_SHA256SUMS.txt` antes da instalação. A publicação em npm fica bloqueada até a licença e a política de distribuição serem aprovadas.

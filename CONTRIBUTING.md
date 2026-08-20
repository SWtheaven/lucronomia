# Contribuindo com a LucronomIA

Este repositório funciona como fonte pública de documentação e ativos técnicos da LucronomIA.

## Antes de alterar

1. Leia o [README](README.md).
2. Consulte o [Brand Guide](docs/BRAND_GUIDE.md).
3. Consulte o [Guia Editorial](docs/EDITORIAL_GUIDE.md).
4. Para peças produzidas no CapCut, siga [PRODUCTION_CAPCUT.md](docs/PRODUCTION_CAPCUT.md).

## Regras de conteúdo

- Não inventar dados, datas, números ou funcionalidades.
- Não subir credenciais, tokens, chaves de API ou dados privados.
- Não alterar a identidade visual documentada sem validação.
- Não criar promessa de retorno financeiro garantido.
- Registrar conteúdos aprovados no [CONTENT_REGISTRY](docs/CONTENT_REGISTRY.md).

## Fluxo recomendado de Git

Para mudanças relevantes:

1. criar uma branch descritiva;
2. fazer commits pequenos e claros;
3. abrir Pull Request contra `main`;
4. revisar documentação e impacto antes do merge;
5. atualizar o changelog quando a mudança alterar baseline, operação ou documentação relevante.

Mudanças emergenciais e triviais podem ser feitas diretamente em `main` quando houver autorização explícita.

## Commits

Preferir mensagens no padrão:

```text
docs: describe change
feat: add capability
fix: correct issue
chore: repository maintenance
content: update editorial asset
```

## Revisão de conteúdo

Antes de aprovar uma peça ou documentação editorial:

- conferir ortografia;
- conferir fontes factuais;
- conferir consistência visual;
- conferir status e datas;
- remover informação não validada;
- confirmar que a peça está alinhada ao posicionamento da marca.

# Changelog

Todas as mudanças relevantes de baseline, documentação e operação pública da LucronomIA devem ser registradas aqui.

## 2026-08-22

### Added

- `MONETIZAÇÃO-002` — primeira V0 do **LucronomIA Fechou** em `fechou/`;
- landing mobile-first;
- formulário do serviço já combinado;
- preview do resumo profissional;
- geração de PDF client-side sem serviço pago;
- mensagem pronta para confirmação via WhatsApp;
- checkout externo configurável em `fechou/config.js`;
- instrumentação mínima de eventos da validação comercial;
- documentação técnica `docs/MONETIZACAO-002-FECHOU-V0.md`.

### Architecture

- V0 estática, sem backend, banco, login ou IA;
- custo incremental de infraestrutura: R$ 0 no hosting estático existente;
- confirmação automática de pagamento via webhook adiada até existir sinal real de vendas.

## 2026-08-20

### Added

- documentação profissional do projeto;
- visão geral da LucronomIA;
- Brand Guide;
- Guia Editorial;
- fluxo operacional de produção no CapCut;
- bios recomendadas para Instagram, TikTok e YouTube;
- registro de conteúdos;
- documentação do FEED-001;
- política de contribuição;
- `.gitignore` com proteção para arquivos locais e credenciais.

### Changed

- README reorganizado para representar a LucronomIA como marca editorial e tecnológica, preservando a documentação pública do LucronomIA Lean.

### Preserved

- páginas públicas do LucronomIA Lean;
- Privacy Policy;
- Terms of Service;
- arquivo de verificação do TikTok;
- estrutura necessária para GitHub Pages.

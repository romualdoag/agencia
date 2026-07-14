# Design: Refactor da homepage AG Soluções & Viagens

**Data:** 2026-07-13
**Status:** Aprovado

## Objetivo

Refatorar a homepage servida por GitHub Pages (CNAME: `agencia.romualdoag.com.br`)
transformando o cartão de visita atual em uma landing page completa de agência de
viagens focada em turismo pessoal/lazer, com proteção forte anti-scraping para os
contatos, e estruturar o `.claude` particionado para as definições futuras do
repositório (que também servirá de repositório de pesquisas).

## Decisões tomadas

| Decisão | Escolha |
| --- | --- |
| Escopo | Landing expandida de seção única (one-page), sem build |
| Proteção de contatos | Camadas fortes (zero contato no HTML, revelação por clique) |
| Posicionamento | Turismo de lazer; tecnologia só como diferencial de atendimento |
| Arquitetura | Arquivos separados: `index.html` + `assets/{css,js,img}` |
| `.claude` | Particionado: CLAUDE.md raiz importando `.claude/rules/*.md` |

## Layout do repositório (alvo)

```
agencia/
├─ index.html
├─ CNAME                      # agencia.romualdoag.com.br (inalterado)
├─ CLAUDE.md                  # enxuto; importa os módulos de regras
├─ assets/
│  ├─ css/style.css
│  ├─ js/contact.js           # camadas de proteção dos contatos
│  └─ img/logo.webp (+ logo.png fallback, ~30–50KB)
├─ .claude/
│  ├─ settings.json           # permissões compartilhadas (commitado)
│  ├─ settings.local.json     # local, fora do git
│  └─ rules/
│     ├─ site.md              # regras da homepage
│     └─ pesquisa.md          # convenções dos tópicos de pesquisa
└─ docs/
   ├─ superpowers/specs/      # specs de design
   └─ pesquisas/
      └─ README.md            # convenção dos tópicos futuros
```

Os PNGs originais de 4MB+ (`AG Solucoes*.png`, `AG Solucoes.jpg`) saem da raiz
(removidos do repo após gerar as versões otimizadas — ficam recuperáveis no
histórico git).

## Seção 1 — Estrutura e visual da página

One-page rolável com âncoras:

1. **Header fixo** — logo pequena + navegação âncora (Serviços, Sobre, Contato).
2. **Hero** — headline de viagens (ex.: "Sua próxima viagem, planejada do jeito
   certo"), subtítulo, CTA WhatsApp protegido.
3. **Serviços** — 3 cards: Pacotes de viagem, Roteiros personalizados, Suporte
   durante a viagem (agilidade de tecnologia como diferencial, não como serviço).
4. **Sobre** — parágrafo curto da agência.
5. **Contato** — botão WhatsApp + e-mail revelável por clique.
6. **Footer** — CNPJ 50.412.734/0001-56 (registro público, permanece visível) e
   nome da empresa.

Visual: identidade atual mantida — azul profundo (`#0E2F44`/`#0047AB`) + laranja
(`#FF5F00`) — com estética mais leve de agência de viagens (gradientes/CSS, sem
fotos stock pesadas). Requisitos transversais:

- Responsivo (mobile-first).
- Acessibilidade: contraste AA, `aria-label`s, navegação por teclado.
- SEO básico: meta description, Open Graph, `lang="pt-BR"`, título descritivo.

## Seção 2 — Proteção anti-scraping dos contatos

Nenhum dado de contato existe no HTML servido nem em literal greppável no fonte.

1. **Zero contato no markup** — sem e-mail, telefone, `mailto:` ou `wa.me` em
   `index.html` ou atributos.
2. **Codificação + fragmentação** — e-mail e número armazenados em `contact.js`
   como fragmentos codificados (Base64 invertido + XOR simples), montados apenas
   em runtime. Strings como `99811` ou `agencia@` não existem literalmente em
   nenhum arquivo do repositório público.
3. **Revelação por interação** — e-mail aparece como botão "Mostrar e-mail"; o
   `mailto:` só é montado e inserido no DOM no clique. A URL `wa.me` (número
   atual do `index.html` existente, com mensagem pré-preenchida) nasce no
   momento do clique. Este spec não repete os contatos em texto plano de
   propósito — o repositório é público.
4. **Honeypot** — e-mail falso invisível (`display:none` + `aria-hidden="true"`)
   no HTML para poluir listas de scrapers ingênuos.
5. **Fallback sem JS** — `<noscript>` com "Ative o JavaScript para ver os
   contatos" (trade-off aceito).

Limite conhecido: humano com navegador sempre consegue copiar o contato; o
objetivo é impedir coleta automatizada em massa.

## Seção 3 — `.claude` particionado

- `CLAUDE.md` (raiz, commitado): descrição de uma linha do repo + imports
  `@.claude/rules/site.md` e `@.claude/rules/pesquisa.md`.
- `.claude/rules/site.md`: identidade visual (cores, logo), regra de nunca
  colocar contato em texto plano em arquivo algum, deploy = push na `main`
  (GitHub Pages), CNAME intocável.
- `.claude/rules/pesquisa.md`: convenções dos tópicos de pesquisa futuros —
  cada tópico em `docs/pesquisas/<slug>/`, formato markdown, fontes citadas,
  índice em `docs/pesquisas/README.md`.
- `.claude/settings.json`: permissões compartilháveis do projeto (commitado);
  `settings.local.json` permanece local.
- `docs/pesquisas/README.md`: explica a convenção e serve de índice.

## Tratamento de erros / casos-limite

- JS desabilitado: `<noscript>` informa como ver os contatos.
- Imagem da logo ausente/lenta: `alt` descritivo + `width`/`height` explícitos
  para evitar layout shift.
- GitHub Pages: site puramente estático; nenhuma dependência externa (sem CDN,
  fonts do sistema) para não criar pontos de falha nem rastreio.

## Testes / verificação

1. `grep` no repositório (working tree) não encontra o número nem o e-mail em
   texto plano em nenhum arquivo. Nota: o histórico git antigo já contém o
   `index.html` atual com o número em claro — aceito como limitação (scrapers
   de página não varrem histórico git); reescrever histórico fica fora de escopo.
2. Página abre localmente: revelação por clique funciona para e-mail e WhatsApp.
3. `view-source` da página não contém contato algum.
4. Lighthouse/inspeção manual: responsivo em 375px e 1440px, contraste AA.
5. Após push: `https://agencia.romualdoag.com.br` serve a nova página.

## Fora de escopo

- Formulário de contato com backend (Pages é estático).
- Multi-página, blog, CMS.
- Os tópicos de pesquisa em si (serão pedidos no futuro).

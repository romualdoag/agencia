# Regras do site

- Site 100% estático servido por GitHub Pages. Deploy = push na `main`. Sem build.
- `CNAME` (`agencia.romualdoag.com.br`) é intocável.
- Zero dependências externas: sem CDN, sem Google Fonts, sem analytics.
- Identidade visual: azul profundo `#0E2F44` / `#0047AB`, laranja `#FF5F00`,
  verde WhatsApp `#25D366`. Logo em `assets/img/` (webp + png, 520px).
- Idioma do site: `pt-BR`.

## Proteção de contatos (crítico)

- NUNCA escrever e-mail, telefone, `mailto:` ou `wa.me` com dados reais em texto
  plano em NENHUM arquivo do repositório (código, docs, commits, testes).
- Contatos vivem apenas como fragmentos codificados em `assets/js/contact.js`
  (esquema: `reverse(base64(xor(texto, chave)))`, revelação só no clique).
- Para alterar um contato: gerar novos fragmentos com o mesmo esquema e validar
  com `node tests/contact.test.js` (testes checam formato via regex, nunca literais).
- O honeypot em `index.html` usa domínio falso — não trocar pelo domínio real.

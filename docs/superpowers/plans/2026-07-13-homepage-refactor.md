# Homepage Refactor (AG Soluções & Viagens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o cartão de visita atual em uma landing page completa de agência de viagens (lazer) servida por GitHub Pages, com contatos protegidos contra scraping e `.claude` particionado.

**Architecture:** Site 100% estático (GitHub Pages, sem build): `index.html` + `assets/{css,js,img}`. Os contatos nunca existem em texto plano no repositório — vivem como fragmentos XOR+Base64 em `contact.js`, decodificados e inseridos no DOM apenas no clique. Regras do projeto particionadas em `.claude/rules/*.md` importadas por um `CLAUDE.md` enxuto.

**Tech Stack:** HTML/CSS/JS vanilla (sem dependências externas), Node.js (testes do decode), Python+Pillow (otimização única da logo).

**Spec:** `docs/superpowers/specs/2026-07-13-homepage-refactor-design.md`

## Global Constraints

- **NUNCA** escrever e-mail, telefone ou URLs `wa.me`/`mailto:` com dados reais em texto plano em NENHUM arquivo do working tree (nem neste plano, nem em testes, nem em commits novos). Os dados existem apenas como fragmentos codificados (já pré-computados neste plano).
- Zero dependências externas na página: sem CDN, sem Google Fonts, sem analytics. Fontes do sistema.
- Idioma: `pt-BR`. Identidade visual: azul profundo `#0E2F44` / `#0047AB`, laranja `#FF5F00`.
- `CNAME` (conteúdo: `agencia.romualdoag.com.br`) é intocável.
- CNPJ `50.412.734/0001-56` permanece visível no footer (registro público).
- Deploy = push na branch `main` (GitHub Pages). Push só no checkpoint final (Task 5).
- Codificação dos contatos (esquema fixo): `encoded = reverse(base64(xor(texto, chave "agviagens")))`, string resultante dividida em 2 fragmentos. Decode: junta fragmentos → reverte string → `atob` → XOR com a mesma chave.

---

### Task 1: Otimizar logo e remover originais pesados

**Files:**
- Create: `assets/img/logo.webp`, `assets/img/logo.png`
- Delete: `AG Solucoes.png` (4.2MB), `AG Solucoes - Null.png` (4.6MB), `AG Solucoes.jpg` (592KB)
- Script one-off (scratchpad, NÃO commitado): `<scratchpad>/optimize_logo.py`

**Interfaces:**
- Produces: `assets/img/logo.webp` e `assets/img/logo.png`, 520px de largura, fundo transparente — consumidos pelo `<picture>` do `index.html` (Task 3).

- [ ] **Step 1: Instalar Pillow**

Run: `python -m pip install --user pillow`
Expected: `Successfully installed pillow-<versão>` (ou "already satisfied")

- [ ] **Step 2: Escrever e rodar o script de otimização**

Salvar no scratchpad como `optimize_logo.py` e rodar a partir da raiz do repo:

```python
from pathlib import Path
from PIL import Image

repo = Path(r"C:\Users\romualdoag\github\agencia")
src = repo / "AG Solucoes - Null.png"  # versão com fundo transparente
out = repo / "assets" / "img"
out.mkdir(parents=True, exist_ok=True)

img = Image.open(src).convert("RGBA")
w = 520
h = round(img.height * w / img.width)
img = img.resize((w, h), Image.LANCZOS)
img.save(out / "logo.webp", "WEBP", quality=85, method=6)
img.save(out / "logo.png", optimize=True)
for f in ("logo.webp", "logo.png"):
    print(f, (out / f).stat().st_size // 1024, "KB")
```

Run: `python <scratchpad>/optimize_logo.py`
Expected: dois arquivos criados, cada um ≤ 120KB (webp tipicamente ≤ 40KB)

- [ ] **Step 3: Remover originais e commitar**

```bash
git rm "AG Solucoes.png" "AG Solucoes - Null.png" "AG Solucoes.jpg"
git add assets/img/logo.webp assets/img/logo.png
git commit -m "Otimiza logo (520px webp+png) e remove originais de 4MB da raiz"
```

Expected: commit criado; `git status` limpo exceto arquivos de outras tasks.

---

### Task 2: contact.js — decodificação e revelação por clique (TDD)

**Files:**
- Create: `assets/js/contact.js`
- Test: `tests/contact.test.js`

**Interfaces:**
- Produces (para Task 3 — o HTML deve usar exatamente estes ganchos):
  - Todo elemento com classe **`.js-whatsapp`** ganha listener de clique que abre `https://wa.me/<numero>?text=<msg>` em nova aba.
  - O botão com id **`#email-btn`** é substituído no clique por `<a class="email-revealed" href="mailto:...">e-mail</a>`.
- Produces (para o teste): quando rodado em Node, `module.exports = { decode, DATA }` onde `decode(parts: string[]): string` e `DATA = { email: string[2], phone: string[2] }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/contact.test.js`. O teste valida apenas FORMATO (regex) — nunca literais de contato:

```js
// Roda com: node tests/contact.test.js
var c = require('../assets/js/contact.js');

var failures = 0;
function assert(cond, msg) {
  if (cond) { console.log('PASS: ' + msg); }
  else { console.error('FAIL: ' + msg); failures++; }
}

var email = c.decode(c.DATA.email);
var phone = c.decode(c.DATA.phone);

assert(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email), 'email decodifica para formato valido');
assert(email.indexOf('romualdoag') !== -1, 'email pertence ao dominio da agencia');
assert(/^55\d{10,11}$/.test(phone), 'phone decodifica para numero BR com codigo do pais');

// Garante que os literais decodificados NAO existem no fonte do proprio contact.js
var fs = require('fs');
var srcText = fs.readFileSync(require.resolve('../assets/js/contact.js'), 'utf8');
assert(srcText.indexOf(email) === -1, 'email nao aparece em texto plano no fonte');
assert(srcText.indexOf(phone.slice(4)) === -1, 'numero local nao aparece em texto plano no fonte');

process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `node tests/contact.test.js`
Expected: FAIL — `Cannot find module '../assets/js/contact.js'`

- [ ] **Step 3: Implementar contact.js**

Criar `assets/js/contact.js` (os fragmentos abaixo já estão pré-computados e validados — copiar verbatim):

```js
/*
 * Protecao de contatos: nenhum dado existe em texto plano.
 * Esquema: reverse(base64(xor(texto, KEY))), dividido em 2 fragmentos.
 * A decodificacao e a insercao no DOM acontecem apenas no clique.
 */
(function () {
  'use strict';

  var KEY = 'agviagens';

  var DATA = {
    email: ['==wFF8EBZQwTU8gCD0', 'ACDogDB4CBOIwBTAAA'],
    phone: ['==gWDZVVC9', 'VXehlXEJFV']
  };

  function xor(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      out += String.fromCharCode(s.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
    }
    return out;
  }

  function decode(parts) {
    var b64 = parts.join('').split('').reverse().join('');
    var bin = typeof atob === 'function'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
    return xor(bin);
  }

  function setupWhatsApp() {
    var buttons = document.querySelectorAll('.js-whatsapp');
    var message = 'Olá! Gostaria de planejar uma viagem com a AG Soluções & Viagens.';
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        var url = 'https://wa.me/' + decode(DATA.phone) +
          '?text=' + encodeURIComponent(message);
        window.open(url, '_blank', 'noopener');
      });
    });
  }

  function setupEmail() {
    var btn = document.getElementById('email-btn');
    if (!btn) { return; }
    btn.addEventListener('click', function () {
      var email = decode(DATA.email);
      var link = document.createElement('a');
      link.href = 'mail' + 'to:' + email;
      link.textContent = email;
      link.className = 'email-revealed';
      btn.replaceWith(link);
    }, { once: true });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setupWhatsApp();
        setupEmail();
      });
    } else {
      setupWhatsApp();
      setupEmail();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { decode: decode, DATA: DATA };
  }
})();
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `node tests/contact.test.js`
Expected: 5x PASS, exit code 0

- [ ] **Step 5: Commit**

```bash
git add assets/js/contact.js tests/contact.test.js
git commit -m "Adiciona protecao de contatos: fragmentos codificados + revelacao por clique"
```

---

### Task 3: index.html + style.css — landing de turismo de lazer

**Files:**
- Modify: `index.html` (substituição completa)
- Create: `assets/css/style.css`

**Interfaces:**
- Consumes (Task 1): `assets/img/logo.webp`, `assets/img/logo.png` (520px, transparente).
- Consumes (Task 2): classe `.js-whatsapp` nos botões de WhatsApp; `#email-btn` no botão de e-mail; `contact.js` estiliza nada — o CSS daqui estiliza `.email-revealed`.
- Regra dura: NENHUM contato real no markup. Honeypot usa domínio falso `viagens-ag-brasil.com` (não existe; não usar o domínio real).

- [ ] **Step 1: Escrever o novo index.html**

Substituir todo o conteúdo de `index.html` por:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="AG Soluções & Viagens — agência de viagens: pacotes, roteiros personalizados e suporte completo para sua próxima viagem.">
    <meta property="og:title" content="AG Soluções & Viagens">
    <meta property="og:description" content="Sua próxima viagem, planejada do jeito certo. Pacotes, roteiros personalizados e suporte durante toda a viagem.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://agencia.romualdoag.com.br/">
    <meta property="og:image" content="https://agencia.romualdoag.com.br/assets/img/logo.png">
    <title>AG Soluções & Viagens — Agência de Viagens</title>
    <link rel="icon" type="image/png" href="assets/img/logo.png">
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

    <header class="site-header">
        <div class="header-inner">
            <a href="#" class="brand" aria-label="AG Soluções &amp; Viagens — início">
                <picture>
                    <source srcset="assets/img/logo.webp" type="image/webp">
                    <img src="assets/img/logo.png" alt="AG Soluções &amp; Viagens" width="130" height="70">
                </picture>
            </a>
            <nav aria-label="Navegação principal">
                <a href="#servicos">Serviços</a>
                <a href="#sobre">Sobre</a>
                <a href="#contato">Contato</a>
            </nav>
        </div>
    </header>

    <main>
        <section class="hero">
            <div class="hero-inner">
                <h1>Sua próxima viagem,<br>planejada do jeito certo.</h1>
                <p class="hero-subtitle">Pacotes, roteiros personalizados e suporte de verdade — do embarque à volta pra casa.</p>
                <button type="button" class="btn-whatsapp js-whatsapp" aria-label="Iniciar conversa no WhatsApp">
                    <svg class="icon-whatsapp" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Planejar minha viagem
                </button>
            </div>
        </section>

        <section id="servicos" class="services">
            <h2>Como podemos ajudar</h2>
            <div class="cards">
                <article class="card">
                    <div class="card-icon" aria-hidden="true">✈️</div>
                    <h3>Pacotes de viagem</h3>
                    <p>Passagens, hospedagem e passeios em um pacote só, no seu orçamento — sem dor de cabeça na hora de montar tudo.</p>
                </article>
                <article class="card">
                    <div class="card-icon" aria-hidden="true">🗺️</div>
                    <h3>Roteiros personalizados</h3>
                    <p>Viagem com a sua cara: roteiro desenhado para o seu ritmo, seus interesses e as pessoas que vão com você.</p>
                </article>
                <article class="card">
                    <div class="card-icon" aria-hidden="true">🛟</div>
                    <h3>Suporte durante a viagem</h3>
                    <p>Imprevisto acontece. Atendimento ágil pelo WhatsApp antes, durante e depois da viagem — resposta rápida, de gente de verdade.</p>
                </article>
            </div>
        </section>

        <section id="sobre" class="about">
            <h2>Sobre a AG</h2>
            <p>A AG Soluções &amp; Viagens é uma agência de viagens que une atendimento próximo com agilidade de tecnologia. Cuidamos do planejamento completo da sua viagem de lazer — da escolha do destino ao suporte no retorno — para você só se preocupar em aproveitar.</p>
        </section>

        <section id="contato" class="contact">
            <h2>Fale com a gente</h2>
            <p>Atendimento direto, sem robô. Escolha o canal:</p>
            <div class="contact-actions">
                <button type="button" class="btn-whatsapp js-whatsapp" aria-label="Conversar no WhatsApp">
                    <svg class="icon-whatsapp" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Chamar no WhatsApp
                </button>
                <button type="button" id="email-btn" class="btn-email" aria-label="Mostrar endereço de e-mail">
                    Mostrar e-mail
                </button>
            </div>
            <noscript>
                <p class="noscript-note">Ative o JavaScript para ver nossos contatos.</p>
            </noscript>
            <!-- honeypot: endereço falso para poluir listas de scrapers -->
            <a href="mailto:atendimento@viagens-ag-brasil.com" class="hp" aria-hidden="true" tabindex="-1">atendimento@viagens-ag-brasil.com</a>
        </section>
    </main>

    <footer class="site-footer">
        <p><strong>AG Soluções &amp; Viagens</strong></p>
        <p>CNPJ: 50.412.734/0001-56</p>
    </footer>

    <script src="assets/js/contact.js"></script>
</body>
</html>
```

- [ ] **Step 2: Escrever assets/css/style.css**

```css
/* AG Soluções & Viagens — identidade: azul #0E2F44/#0047AB, laranja #FF5F00 */

* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
    --blue-dark: #0E2F44;
    --blue: #0047AB;
    --orange: #FF5F00;
    --whatsapp: #25D366;
    --text: #2b3a45;
    --text-light: #5c6b76;
    --bg: #f7f9fb;
}

html { scroll-behavior: smooth; }

body {
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: var(--text);
    background: var(--bg);
    line-height: 1.6;
}

/* Header */
.site-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(6px);
    border-bottom: 1px solid #e4e9ee;
}

.header-inner {
    max-width: 1040px;
    margin: 0 auto;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.brand img { display: block; width: 130px; height: auto; }

.site-header nav { display: flex; gap: 24px; }

.site-header nav a {
    color: var(--blue-dark);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95em;
}

.site-header nav a:hover,
.site-header nav a:focus-visible { color: var(--orange); }

/* Hero */
.hero {
    background:
        radial-gradient(circle at 20% 30%, rgba(0, 71, 171, 0.55) 0%, transparent 55%),
        radial-gradient(circle at 80% 70%, rgba(255, 95, 0, 0.25) 0%, transparent 50%),
        linear-gradient(160deg, var(--blue-dark) 0%, var(--blue) 100%);
    color: #fff;
    text-align: center;
    padding: 96px 20px 110px;
}

.hero-inner { max-width: 720px; margin: 0 auto; }

.hero h1 {
    font-size: clamp(1.9em, 5vw, 3em);
    line-height: 1.15;
    font-weight: 700;
    margin-bottom: 18px;
}

.hero-subtitle {
    font-size: clamp(1.05em, 2.5vw, 1.3em);
    color: rgba(255, 255, 255, 0.85);
    margin-bottom: 36px;
}

/* Botões */
.btn-whatsapp,
.btn-email {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 32px;
    border-radius: 50px;
    font-size: 1.05em;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    border: none;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.btn-whatsapp {
    background-color: var(--whatsapp);
    color: #fff;
    box-shadow: 0 4px 15px rgba(37, 211, 102, 0.35);
}

.btn-whatsapp:hover,
.btn-whatsapp:focus-visible {
    background-color: #1ebc51;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(37, 211, 102, 0.5);
}

.icon-whatsapp { width: 22px; height: 22px; fill: currentColor; flex-shrink: 0; }

.btn-email {
    background: #fff;
    color: var(--blue-dark);
    border: 2px solid var(--blue-dark);
}

.btn-email:hover,
.btn-email:focus-visible {
    background: var(--blue-dark);
    color: #fff;
    transform: translateY(-2px);
}

.email-revealed {
    display: inline-block;
    padding: 16px 32px;
    font-size: 1.05em;
    font-weight: 700;
    color: var(--blue);
}

/* Seções */
main section { padding: 72px 20px; }

.services, .about, .contact { max-width: 1040px; margin: 0 auto; }

main h2 {
    color: var(--blue-dark);
    font-size: clamp(1.5em, 3.5vw, 2em);
    text-align: center;
    margin-bottom: 40px;
}

.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 24px;
}

.card {
    background: #fff;
    border-radius: 16px;
    padding: 32px 26px;
    box-shadow: 0 6px 20px rgba(14, 47, 68, 0.08);
    border-top: 4px solid var(--orange);
}

.card-icon { font-size: 2em; margin-bottom: 14px; }

.card h3 { color: var(--blue-dark); margin-bottom: 10px; font-size: 1.15em; }

.card p { color: var(--text-light); font-size: 0.97em; }

/* Sobre */
.about { text-align: center; }

.about p {
    max-width: 680px;
    margin: 0 auto;
    color: var(--text-light);
    font-size: 1.08em;
}

/* Contato */
.contact { text-align: center; }

.contact > p { color: var(--text-light); margin-bottom: 28px; }

.contact-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
}

.noscript-note { margin-top: 20px; color: var(--orange); font-weight: 600; }

/* Honeypot: invisível para humanos e leitores de tela */
.hp { display: none !important; }

/* Footer */
.site-footer {
    background: var(--blue-dark);
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
    padding: 28px 20px;
    font-size: 0.9em;
}

.site-footer strong { color: #fff; }

@media (max-width: 600px) {
    .hero { padding: 64px 20px 72px; }
    main section { padding: 52px 16px; }
    .site-header nav { gap: 14px; font-size: 0.9em; }
}
```

- [ ] **Step 3: Verificar que nenhum contato real existe no working tree**

Run (Git Bash, na raiz):
```bash
grep -rn -e "99811" -e "4153" -e "agencia@" --include="*.html" --include="*.css" --include="*.js" --include="*.md" --include="*.json" .
```
Expected: nenhuma linha. (O prefixo `https://wa.me/` sem número em `contact.js` e menções ao subdomínio `agencia.romualdoag.com.br` são permitidos — não são dados de contato.)

- [ ] **Step 4: Testar a página no navegador local**

Run: `python -m http.server 8000` (background, na raiz do repo)
Abrir `http://localhost:8000` com a ferramenta de browser disponível (chrome-devtools ou playwright) e verificar:
1. Página renderiza: header, hero, 3 cards, sobre, contato, footer.
2. `view-source` (fetch do HTML cru) não contém `@` de e-mail real nem dígitos do telefone.
3. Clique em "Mostrar e-mail" → aparece link `mailto:` com o e-mail correto.
4. Clique em botão WhatsApp → tenta abrir `wa.me/55...` (popup pode ser bloqueado; basta verificar a chamada).
5. Viewport 375px: layout não quebra.

Expected: todos os 5 checks OK.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/css/style.css
git commit -m "Refatora homepage: landing de turismo de lazer com contatos protegidos"
```

---

### Task 4: `.claude` particionado + docs/pesquisas

**Files:**
- Create: `CLAUDE.md` (raiz do repo)
- Create: `.claude/rules/site.md`
- Create: `.claude/rules/pesquisa.md`
- Create: `.claude/settings.json`
- Create: `docs/pesquisas/README.md`
- Verify: `.claude/settings.local.json` NÃO é commitado (adicionar `.gitignore` se preciso)

**Interfaces:**
- Produces: convenção de pesquisa (`docs/pesquisas/<slug>/`) que os pedidos futuros de pesquisa vão seguir.

- [ ] **Step 1: Criar CLAUDE.md na raiz**

```markdown
# AG Soluções & Viagens — agencia.romualdoag.com.br

Homepage estática da agência (GitHub Pages, deploy = push na `main`) e
repositório de pesquisas em `docs/pesquisas/`.

Regras particionadas por tema:

@.claude/rules/site.md
@.claude/rules/pesquisa.md
```

- [ ] **Step 2: Criar .claude/rules/site.md**

```markdown
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
```

- [ ] **Step 3: Criar .claude/rules/pesquisa.md**

```markdown
# Regras dos tópicos de pesquisa

Este repositório também guarda pesquisas solicitadas pelo usuário.

- Cada tópico vive em `docs/pesquisas/<slug>/` (slug kebab-case, pt-BR).
- Arquivo principal: `docs/pesquisas/<slug>/README.md`.
- Toda afirmação factual relevante cita a fonte (URL + data de acesso).
- Ao criar um tópico, adicionar uma linha no índice `docs/pesquisas/README.md`.
- Pesquisas não aparecem no site (GitHub Pages serve o repo inteiro; conteúdo
  em `docs/` é público mas não linkado na homepage).
```

- [ ] **Step 4: Criar .claude/settings.json**

```json
{
  "permissions": {
    "allow": [
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(node tests/contact.test.js)",
      "Bash(python -m http.server:*)"
    ]
  }
}
```

- [ ] **Step 5: Criar docs/pesquisas/README.md**

```markdown
# Pesquisas

Índice dos tópicos de pesquisa deste repositório.
Convenções em `.claude/rules/pesquisa.md`.

| Tópico | Pasta | Data |
| --- | --- | --- |
| _(nenhum ainda)_ | | |
```

- [ ] **Step 6: Garantir que settings.local.json fica fora do git**

Criar `.gitignore` na raiz (se não existir):

```
.claude/settings.local.json
```

Run: `git status --short`
Expected: `settings.local.json` NÃO aparece como untracked (ignorado).

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md .claude/rules/ .claude/settings.json docs/pesquisas/README.md .gitignore
git commit -m "Estrutura .claude particionado e convencao de pesquisas"
```

---

### Task 5: Verificação final e deploy

**Files:** nenhum novo — verificação e push.

- [ ] **Step 1: Suite completa de verificação**

```bash
node tests/contact.test.js
grep -rn -e "99811" -e "4153" -e "agencia@" --include="*.html" --include="*.css" --include="*.js" --include="*.md" --include="*.json" .
git status --short
```
Expected: teste passa (exit 0); grep sem resultados; working tree limpo.

- [ ] **Step 2: Checkpoint com o usuário antes do push**

Push na `main` publica o site imediatamente. Confirmar com o usuário (ou, se já autorizado, prosseguir).

- [ ] **Step 3: Push (deploy)**

```bash
git push origin main
```

- [ ] **Step 4: Verificar produção**

Aguardar 1-3 min do build do Pages e abrir `https://agencia.romualdoag.com.br`:
1. Nova landing no ar.
2. Fonte da página (HTML cru) sem contatos.
3. Botões de revelação funcionam em produção.

Expected: os 3 checks OK.

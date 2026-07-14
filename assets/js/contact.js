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

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

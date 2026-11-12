// Privacy policy shared by every client page. The business data comes from
// /legal/clients/<c>.json; sections marked data-if="<field>" show only when the
// field is filled (or true), so one text fits every client.
(function () {
  var params = new URLSearchParams(location.search);
  var id = (params.get('c') || '').toLowerCase();

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function filled(value) {
    if (value && typeof value === 'object') return Object.keys(value).some(function (k) { return filled(value[k]); });
    return value === true || (typeof value === 'string' && value.trim() !== '');
  }

  function showLang(lang) {
    document.querySelectorAll('article[data-lang]').forEach(function (a) { a.hidden = a.dataset.lang !== lang; });
    document.documentElement.lang = lang;
    document.title = lang === 'ro' ? 'Politica de confidențialitate' : 'Privacy policy';
    document.querySelector('[data-title]').textContent = document.title;
  }

  function fail() {
    document.querySelectorAll('article[data-lang]').forEach(function (a) { a.hidden = true; });
    document.querySelector('.error').hidden = false;
  }

  if (!/^[a-z0-9-]+$/.test(id)) { fail(); return; }

  fetch('/legal/clients/' + id + '.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      // A company block counts as filled once its legal name is set.
      if (data.company && !filled(data.company.legalName)) data.company = {};

      document.querySelectorAll('[data-if]').forEach(function (el) {
        el.hidden = !filled(get(data, el.dataset.if));
      });
      document.querySelectorAll('[data-f]').forEach(function (el) {
        var v = get(data, el.dataset.f);
        if (filled(v)) el.textContent = v;
      });

      var email = get(data, 'contact.email') || '';
      var phone = (get(data, 'contact.phone') || '').replace(/[^\d+]/g, '');
      document.querySelectorAll('[data-href="mailto"]').forEach(function (a) { a.href = 'mailto:' + email; });
      document.querySelectorAll('[data-href="tel"]').forEach(function (a) { a.href = 'tel:' + phone; });
      if (/^https:\/\//.test(data.site || '')) {
        document.querySelectorAll('[data-href="site"]').forEach(function (a) { a.href = data.site; });
        document.querySelector('.back').hidden = false;
      }

      var lang = params.get('lang') || data.lang || 'ro';
      showLang(lang === 'en' ? 'en' : 'ro');
    })
    .catch(fail);

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-switch]');
    if (!a) return;
    e.preventDefault();
    params.set('lang', a.dataset.switch);
    history.replaceState(null, '', '?' + params);
    showLang(a.dataset.switch);
  });
})();

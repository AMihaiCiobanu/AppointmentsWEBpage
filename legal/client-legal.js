// Legal parts shared by every client page (loaded from appointmentsapps.com):
// 1. Footer: the page holds
//      <div class="client-legal" data-client-legal="<id>"> <a href=".../legal/client/?c=<id>">…</a> </div>
//    This reads /legal/clients/<id>.json and, only when the company details are filled
//    in, adds them and (for Romanian businesses) the ANPC SAL link.
// 2. Map on click: an element with data-map-src (and data-map-title) holding a
//    [data-map-load] button gets the Google Maps iframe in place of its content only when pressed,
//    so Google gets nothing before the visitor asks for the map.
(function () {
  var script = document.currentScript;
  var origin = script ? new URL(script.src).origin : 'https://appointmentsapps.com';

  function filled(v) { return typeof v === 'string' && v.trim() !== ''; }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text) n.textContent = text;
    return n;
  }

  function render(box, data) {
    var c = data.company || {};
    if (!filled(c.legalName)) return;
    var ro = (data.lang || 'ro') === 'ro';

    var parts = [c.legalName + (filled(c.form) ? ' ' + c.form : '')];
    if (filled(c.cui)) parts.push((ro ? 'CUI ' : 'Company ID ') + c.cui);
    if (filled(c.regCom)) parts.push((ro ? 'Nr. Reg. Com. ' : 'Reg. no. ') + c.regCom);
    if (filled(c.address)) parts.push(c.address);
    box.appendChild(el('p', { 'class': 'client-legal-company' }, parts.join(' · ')));

    if (data.country === 'RO') {
      var a = el('a', {
        href: 'https://reclamatiisal.anpc.ro',
        target: '_blank',
        rel: 'noopener',
        'class': 'client-legal-anpc'
      });
      var img = el('img', {
        src: origin + '/legal/assets/anpc-sal.png',
        alt: 'ANPC – Soluționarea alternativă a litigiilor',
        width: '250',
        height: '50',
        loading: 'lazy'
      });
      // Ordinul ANPC 449/2022 (as amended by Ordinul 270/2026): 250 x 50 px, linking to reclamatiisal.anpc.ro.
      // The official image is 201 x 50, so it sits centred in a white 250 x 50 box instead of being stretched.
      img.style.cssText = 'display:block;width:250px;max-width:100%;height:50px;object-fit:contain;background:#fff;border-radius:4px';
      // Text link if the image fails to load.
      img.onerror = function () { a.textContent = 'ANPC – Soluționarea alternativă a litigiilor (SAL)'; };
      a.appendChild(img);
      box.appendChild(a);
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-map-load]');
    var box = btn && btn.closest('[data-map-src]');
    if (!box || !/^https:\/\/www\.google\.com\/maps\/embed\?/.test(box.getAttribute('data-map-src'))) return;
    var frame = el('iframe', {
      src: box.getAttribute('data-map-src'),
      title: box.getAttribute('data-map-title') || 'Google Maps',
      allowfullscreen: '',
      referrerpolicy: 'strict-origin-when-cross-origin'
    });
    // Keep the box (its size and rounded frame) and put the map inside it.
    box.removeAttribute('data-map-src');
    box.replaceChildren(frame);
    frame.focus();
  });

  document.querySelectorAll('[data-client-legal]').forEach(function (box) {
    // Point the policy link at the same server this script came from (local preview stays local).
    box.querySelectorAll('a[href^="https://appointmentsapps.com/legal/"]').forEach(function (a) {
      a.href = origin + a.getAttribute('href').slice('https://appointmentsapps.com'.length);
    });
    var id = (box.getAttribute('data-client-legal') || '').toLowerCase();
    if (!/^[a-z0-9-]+$/.test(id)) return;
    fetch(origin + '/legal/clients/' + id + '.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data) render(box, data); })
      .catch(function () { /* footer stays with the policy link only */ });
  });
})();

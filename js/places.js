(function () {
  var S = WaseelaStore, user = S.currentUser();
  if (!user) { location.replace('login.html'); return; }

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function say(id, t, ok) { var m = $(id); m.textContent = t; m.className = 'form-msg' + (ok ? ' ok' : ''); }

  if (user.role === 'driver') { $('driverView').hidden = false; return; }
  $('riderView').hidden = false;

  function render() {
    var list = S.myFavorites(), ul = $('favs'); ul.innerHTML = '';
    $('emptyView').hidden = list.length > 0;
    $('count').hidden = !list.length; $('count').textContent = list.length.toLocaleString('ar');
    list.forEach(function (f) {
      var li = el('li', 'fav'), route = el('div', 'route'), act = el('div', 'actions');
      li.appendChild(el('h4', null, f.label));
      route.appendChild(el('i', null, 'من')); route.appendChild(el('b', null, f.from));
      route.appendChild(el('i', null, 'إلى')); route.appendChild(el('b', null, f.to));
      li.appendChild(route);
      var go = el('a', 'cta', 'اطلب الآن'); go.href = 'request.html?fav=' + encodeURIComponent(f.id);
      var del = el('button', 'ghost', 'حذف'); del.type = 'button';
      del.onclick = function () {
        if (!confirm('حذف «' + f.label + '» من أماكني؟')) return;
        S.removeFavorite(f.id).then(function () { say('msg', ''); render(); }).catch(function () { say('msg', 'تعذّر الحذف.'); render(); });
      };
      act.appendChild(go); act.appendChild(del); li.appendChild(act); ul.appendChild(li);
    });
  }

  /* تعبئة مسبقة من سجل الرحلات: places.html?from=..&to=.. */
  var q = new URLSearchParams(location.search);
  if (q.get('from') && q.get('to')) {
    $('from').value = q.get('from'); $('to').value = q.get('to');
    $('label').value = (q.get('from') + ' ← ' + q.get('to')).slice(0, 30);
    $('label').focus(); $('label').select();
  }

  $('addForm').onsubmit = function (e) {
    e.preventDefault(); say('addMsg', '');
    S.addFavorite({ label: $('label').value, from: $('from').value, to: $('to').value }).then(function () {
      $('label').value = $('from').value = $('to').value = '';
      say('addMsg', 'تم الحفظ في أماكني.', true); render();
      if (history.replaceState) history.replaceState(null, '', 'places.html');
    }).catch(function (err) {
      var c = err && err.code;
      say('addMsg', c === 'INVALID_LABEL' ? 'اكتب اسماً للمشوار (حرفان على الأقل).'
        : c === 'INVALID_PLACES' ? 'اكتب نقطة الانطلاق والوجهة، ولازم تكون مختلفتين.'
        : c === 'DUPLICATE' ? 'هذا المشوار محفوظ بالفعل.'
        : c === 'LIMIT' ? 'وصلت للحد الأقصى (' + S.MAX_FAVS.toLocaleString('ar') + ' مشوار). احذف واحداً لتضيف جديداً.'
        : 'تعذّر الحفظ.');
    });
  };

  window.addEventListener('storage', render);
  render();
})();

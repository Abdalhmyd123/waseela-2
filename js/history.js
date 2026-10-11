(function () {
  var S = WaseelaStore, user = S.currentUser();
  if (!user) { location.replace('login.html'); return; }

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(iso) { try { return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } }
  function paxText(n) { return n + (n === 1 ? ' راكب' : n === 2 ? ' راكبان' : ' ركاب'); }
  function num(n) { return Number(n).toLocaleString('ar'); }
  var LABEL = { completed: 'مكتملة', pending: 'بانتظار سائق', accepted: 'مع الكابتن', cancelled: 'ملغية' };
  var TABS = [['all', 'الكل'], ['completed', 'مكتملة'], ['active', 'جارية'], ['cancelled', 'ملغية']];
  var filter = 'all';

  if (user.role === 'driver') { $('driverView').hidden = false; return; }
  $('riderView').hidden = false;

  function inFilter(r) {
    return filter === 'all' || (filter === 'active' ? (r.status === 'pending' || r.status === 'accepted') : r.status === filter);
  }

  function card(r) {
    var li = el('li', 'trip-card'), top = el('div', 'top');
    top.appendChild(el('span', null, fmt(r.createdAt)));
    top.appendChild(el('span', 'st ' + r.status, LABEL[r.status] || r.status));
    li.appendChild(top);

    var route = el('div', 'route');
    route.appendChild(el('i', null, 'من')); route.appendChild(el('b', null, r.from + (r.fromCoords ? ' (موقعي)' : '')));
    route.appendChild(el('i', null, 'إلى')); route.appendChild(el('b', null, r.to));
    li.appendChild(route);

    var f = el('div', 'facts');
    f.appendChild(el('span', null, paxText(r.passengers) + ' · ' + (r.payment === 'bankak' ? 'بنكك' : 'نقداً') + (r.when !== 'now' ? ' · مجدولة' : '')));
    var fare = el('span'); fare.appendChild(document.createTextNode('السعر: '));
    fare.appendChild(el('strong', null, r.fare ? num(r.fare) + ' جنيه' : 'مفتوح')); f.appendChild(fare);
    li.appendChild(f);

    if (r.driver) {
      var c = el('div', 'cap');
      if (r.status === 'completed' && !r.rating) {
        var a = el('a', null, 'قيّم الكابتن ' + r.driver.name); a.href = 'rate.html?trip=' + encodeURIComponent(r.id); c.appendChild(a);
      } else {
        c.textContent = 'الكابتن ' + r.driver.name + (r.rating ? ' — ' + '★'.repeat(r.rating.stars) + '☆'.repeat(5 - r.rating.stars) : '');
      }
      li.appendChild(c);
    }

    var act = el('div', 'actions');
    var again = el('a', 'cta', 'أعد الطلب'); again.href = 'request.html?again=' + encodeURIComponent(r.id); act.appendChild(again);
    if (!r.fromCoords) {
      if (S.findFavorite(r.from, r.to)) act.appendChild(el('span', 'saved-note', '★ محفوظ في أماكني'));
      else {
        var save = el('a', 'ghost green', 'احفظ في أماكني');
        save.href = 'places.html?from=' + encodeURIComponent(r.from) + '&to=' + encodeURIComponent(r.to); act.appendChild(save);
      }
    }
    li.appendChild(act);
    return li;
  }

  function renderStats(all) {
    var box = $('stats'); box.innerHTML = '';
    [[all.length, 'كل الرحلات'], [all.filter(function (r) { return r.status === 'completed'; }).length, 'مكتملة'],
     [all.filter(function (r) { return r.status === 'cancelled'; }).length, 'ملغية']].forEach(function (x) {
      var d = el('div', 'stat'); d.appendChild(el('b', null, num(x[0]))); d.appendChild(el('span', null, x[1])); box.appendChild(d);
    });
  }
  function renderTabs() {
    var wrap = $('tabs'); wrap.innerHTML = '';
    TABS.forEach(function (t) {
      var lab = el('label', 'opt'), i = el('input'); i.type = 'radio'; i.name = 'f'; i.value = t[0]; i.checked = filter === t[0];
      i.onchange = function () { filter = t[0]; render(); };
      lab.appendChild(i); lab.appendChild(el('span', null, t[1])); wrap.appendChild(lab);
    });
  }

  function render() {
    var all = S.tripHistory(), list = all.filter(inFilter), ul = $('trips'); ul.innerHTML = '';
    renderStats(all);
    $('count').hidden = !all.length; $('count').textContent = num(all.length);
    $('tabs').hidden = !all.length;
    list.forEach(function (r) { ul.appendChild(card(r)); });
    var none = !list.length;
    $('emptyView').hidden = !none;
    if (none) {
      $('emptyTitle').textContent = all.length ? 'لا توجد رحلات في هذا التصنيف' : 'لا توجد رحلات بعد';
      $('emptyText').textContent = all.length ? 'جرّب تصنيفاً آخر.' : 'ستظهر رحلاتك هنا بعد أن تطلب أول ركشة.';
      $('emptyCta').hidden = !!all.length;
    }
  }

  renderTabs(); render();
  window.addEventListener('storage', render);
})();

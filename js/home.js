(function () {
  var S = WaseelaStore, user = S.currentUser();
  if (!user) { location.replace('login.html'); return; }

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function num(n) { return Number(n).toLocaleString('ar'); }
  function fmt(iso) { try { return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } }
  function ago(iso) {
    var m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    if (m < 1) return 'الآن'; if (m < 60) return 'قبل ' + num(m) + ' د';
    var h = Math.round(m / 60); return h < 24 ? 'قبل ' + num(h) + ' س' : fmt(iso);
  }
  var driver = user.role === 'driver';
  var ST = { pending: 'بانتظار سائق', accepted: 'مع الكابتن', completed: 'مكتملة', cancelled: 'ملغية' };
  function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  /* ---------- الرأس ---------- */
  var hr = new Date().getHours();
  $('when').textContent = hr >= 4 && hr < 12 ? 'صباح الخير' : 'مساء الخير';
  $('hello').textContent = 'أهلاً يا ' + user.name.split(' ')[0];
  $('avatar').textContent = user.name.trim().charAt(0) || '؟';
  $('storeWarn').hidden = S.isPersistent();

  /* ---------- العميل ---------- */
  function trip(r) {
    var li = el('li'), a = el('a', 'trip'), m = el('div', 'm');
    a.href = 'history.html';
    a.appendChild(el('div', 'r', r.from + (r.fromCoords ? ' (موقعي)' : '') + ' ← ' + r.to));
    m.appendChild(el('span', null, fmt(r.createdAt)));
    m.appendChild(el('span', 's ' + r.status, ST[r.status]));
    a.appendChild(m);
    if (r.rating) a.appendChild(el('div', 'stars', stars(r.rating.stars)));
    li.appendChild(a); return li;
  }
  function renderRider() {
    $('riderHome').hidden = false;
    var act = S.activeRequest();
    $('rActive').hidden = !act; $('rAsk').hidden = !!act;
    if (act) {
      var acc = act.status === 'accepted';
      $('rStatus').textContent = acc ? 'الكابتن في الطريق إليك' : 'بانتظار سائق';
      $('rStatus').className = 'chip' + (acc ? ' ok' : '');
      $('rAge').textContent = ago(act.createdAt);
      $('rFrom').textContent = act.from + (act.fromCoords ? ' (موقعي)' : ''); $('rTo').textContent = act.to;
      $('rDriver').hidden = !acc; if (acc) $('rDriver').textContent = 'الكابتن: ' + act.driver.name;
    }
    var rate = S.ratableTrips()[0];
    $('rRate').hidden = !rate;
    if (rate) { $('rRateText').textContent = 'كيف كانت رحلتك مع ' + rate.driver.name + '؟'; $('rRate').href = 'rate.html?trip=' + encodeURIComponent(rate.id); }

    var favs = S.myFavorites().slice(0, 6), box = $('rFavs'); box.innerHTML = '';
    $('rFavsEmpty').hidden = favs.length > 0;
    favs.forEach(function (f) { var a = el('a', 'fav', f.label); a.href = 'request.html?fav=' + encodeURIComponent(f.id); a.title = f.from + ' ← ' + f.to; box.appendChild(a); });

    var recent = S.tripHistory().slice(0, 3), ul = $('rTrips'); ul.innerHTML = '';
    $('rTripsEmpty').hidden = recent.length > 0;
    recent.forEach(function (r) { ul.appendChild(trip(r)); });
  }

  /* ---------- الكابتن ---------- */
  function stat(v, l) { var d = el('div', 'stat'); d.appendChild(el('b', null, v)); d.appendChild(el('span', null, l)); return d; }
  function renderDriver() {
    $('driverHome').hidden = false;
    var sub = S.mySubscription(), box = $('dSub'), on = !!sub && sub.active;
    var soon = on && new Date(sub.expiresAt).getTime() - Date.now() < 86400000;
    box.className = 'sub' + (!on || soon ? ' warn' : '');
    $('dSubTitle').textContent = on ? (soon ? 'اشتراكك ينتهي قريباً' : 'اشتراكك ساري') : sub ? 'انتهى اشتراكك' : 'لا يوجد اشتراك';
    $('dSubText').textContent = on ? 'حتى ' + fmt(sub.expiresAt) : 'جرّب العرض المجاني أو اختر باقة';
    $('dSubBtn').textContent = on && !soon ? 'التفاصيل' : on ? 'جدّد' : 'اشترك';

    var t = S.myActiveTrip(); $('dTrip').hidden = !t;
    if (t) {
      $('dTripAge').textContent = 'قبلتها ' + ago(t.acceptedAt || t.createdAt);
      $('dTripName').textContent = t.userName; $('dFrom').textContent = t.from + (t.fromCoords ? ' (موقع الراكب)' : ''); $('dTo').textContent = t.to;
      $('dMap').href = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(t.fromCoords ? t.fromCoords.lat + ',' + t.fromCoords.lng : t.from);
      $('dMap').textContent = t.fromCoords ? 'فتح موقع الراكب في الخرائط' : 'ابحث عن «' + t.from + '» في الخرائط';
      $('dTripFare').hidden = !t.fare; if (t.fare) $('dTripFare').textContent = 'السعر: ' + num(t.fare) + ' جنيه · ' + (t.payment === 'bankak' ? 'بنكك' : 'نقداً');
    }

    var st = S.myStats(), open = S.openRequests();
    if (S.mySettings().instantOnly) open = open.filter(function (r) { return r.when === 'now'; });
    var s = $('dStats'); s.innerHTML = '';
    s.appendChild(stat(num(st.trips), 'رحلة منجزة'));
    s.appendChild(stat(st.avg == null ? '—' : num(st.avg.toFixed(1)) + ' ★', 'التقييم'));
    s.appendChild(stat(num(open.length), 'طلب متاح'));

    $('dBadge').hidden = !open.length; $('dBadge').textContent = num(open.length);
    $('dAskText').textContent = t ? 'أنهِ رحلتك الحالية لتقبل غيرها' : open.length ? 'اقبل طلباً الآن' : 'لا توجد طلبات الآن';

    var done = S.driverTrips().filter(function (r) { return r.status === 'completed'; }).slice(0, 3), ul = $('dTrips'); ul.innerHTML = '';
    $('dTripsEmpty').hidden = done.length > 0;
    done.forEach(function (r) {
      var li = el('li'), d = el('div', 'trip'), m = el('div', 'm');
      d.appendChild(el('div', 'r', r.userName + ' — ' + r.from + ' ← ' + r.to));
      m.appendChild(el('span', null, fmt(r.completedAt || r.createdAt)));
      m.appendChild(el('span', r.rating ? 'stars' : '', r.rating ? stars(r.rating.stars) : 'بلا تقييم'));
      d.appendChild(m); li.appendChild(d); ul.appendChild(li);
    });
  }

  function render() { if (driver) renderDriver(); else renderRider(); }
  render();
  window.addEventListener('storage', render);
  setInterval(function () { if (!document.hidden) render(); }, 10000);
})();

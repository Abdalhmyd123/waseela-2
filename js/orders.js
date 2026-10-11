(function () {
  var S = WaseelaStore, user = S.currentUser();
  if (!user) { location.replace('login.html'); return; }

  var $ = function (id) { return document.getElementById(id); };
  var list = $('orders'), msg = $('msg');

  function fmt(iso) {
    try { return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; }
  }
  function ago(iso) {
    var m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    if (m < 1) return 'الآن'; if (m < 60) return 'قبل ' + m.toLocaleString('ar') + ' د';
    var h = Math.round(m / 60); if (h < 24) return 'قبل ' + h.toLocaleString('ar') + ' س';
    return fmt(iso);
  }
  function paxText(n) { return n + (n === 1 ? ' راكب' : n === 2 ? ' راكبان' : ' ركاب'); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function flash(t) { msg.textContent = t; }

  /* ---------- الموقع والخرائط ---------- */
  var me = null;                                   // موقع الكابتن (بعد أن يضغط «حدّد موقعي»)
  function mapUrl(q) { return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(q); }
  function coordQ(c) { return c.lat + ',' + c.lng; }
  function distKm(a, b) {
    var t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lng - a.lng) * t;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * 6371 * Math.asin(Math.sqrt(x));
  }
  function distText(c) {
    if (!me || !c) return '';
    var k = distKm(me, c);
    return 'يبعد عنك نحو ' + (k < 1 ? (Math.max(50, Math.round(k * 1000 / 50) * 50)).toLocaleString('ar') + ' م' : k.toFixed(1).replace('.', '٫').replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }) + ' كم') + ' (خط مستقيم)';
  }
  function accText(c) { return c && c.accuracy ? 'دقة الموقع ±' + num(c.accuracy) + ' م' : ''; }
  function num(n) { return Number(n).toLocaleString('ar'); }
  function link(cls, text, url) { var a = el('a', cls, text); a.href = url; a.target = '_blank'; a.rel = 'noopener'; return a; }
  function locBlock(r) {
    var box = el('div', 'maploc');
    if (r.fromCoords) {
      box.appendChild(link('maplink', 'فتح موقع الراكب في الخرائط', mapUrl(coordQ(r.fromCoords))));
      var info = [distText(r.fromCoords), accText(r.fromCoords), r.locationAt ? 'حُدِّث ' + ago(r.locationAt) : ''].filter(Boolean).join(' · ');
      if (info) box.appendChild(el('p', 'locinfo', info));
    } else {
      box.appendChild(link('maplink alt', 'ابحث عن «' + r.from + '» في الخرائط', mapUrl(r.from)));
      box.appendChild(el('p', 'locinfo', 'الراكب لم يشارك موقعه، والعنوان مكتوب نصاً.'));
    }
    return box;
  }
  $('locBtn').onclick = function () {
    var b = this, note = $('locNote');
    if (!navigator.geolocation) { note.hidden = false; note.textContent = 'المتصفح لا يدعم تحديد الموقع.'; return; }
    b.disabled = true; b.textContent = 'جارٍ التحديد…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      b.disabled = false; b.textContent = 'حدّث موقعي'; note.hidden = false; note.textContent = 'تم تحديد موقعك. المسافات تقريبية بخط مستقيم، والخرائط تعطيك الطريق الفعلي.';
      render();
    }, function () {
      b.disabled = false; b.textContent = 'حدّد موقعي لعرض المسافة للركاب';
      note.hidden = false; note.textContent = 'تعذّر تحديد موقعك. اسمح للمتصفح بالوصول للموقع وحاول مرة ثانية.';
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  function card(r, busy) {
    var li = el('li', 'order'), tags = el('div', 'tags');
    tags.appendChild(el('span', 'tag ' + (r.when === 'now' ? 'now' : 'later'), r.when === 'now' ? 'فوري' : 'مجدول: ' + fmt(r.when)));
    tags.appendChild(el('span', 'tag', ago(r.createdAt)));
    li.appendChild(tags);

    var route = el('div', 'route');
    route.appendChild(el('i', null, 'من')); route.appendChild(el('b', null, r.from + (r.fromCoords ? ' (موقع الراكب)' : '')));
    route.appendChild(el('i', null, 'إلى')); route.appendChild(el('b', null, r.to));
    li.appendChild(route);

    var f = el('div', 'facts');
    var p = el('span'); p.appendChild(document.createTextNode(paxText(r.passengers) + ' · ' + (r.payment === 'bankak' ? 'بنكك' : 'نقداً'))); f.appendChild(p);
    var fare = el('span'); fare.appendChild(document.createTextNode('السعر: '));
    fare.appendChild(el('strong', null, r.fare ? r.fare.toLocaleString('ar') + ' جنيه' : 'مفتوح')); f.appendChild(fare);
    li.appendChild(f);
    if (r.notes) li.appendChild(el('p', 'note-line', 'ملاحظة: ' + r.notes));
    li.appendChild(locBlock(r));

    var b = el('button', 'cta', 'قبول الطلب'); b.type = 'button'; b.disabled = busy;
    b.onclick = function () {
      b.disabled = true; b.textContent = 'جارٍ القبول…'; flash('');
      S.acceptRequest(r.id).then(function () {
        window.dispatchEvent(new CustomEvent('waseela:request-accepted', { detail: r }));
        render(); window.scrollTo(0, 0);
      }).catch(function (e) {
        flash(e && e.code === 'TAKEN' ? 'سبقك كابتن آخر لهذا الطلب.' : e && e.code === 'DRIVER_BUSY' ? 'أنهِ رحلتك الحالية أولاً.' : 'تعذّر قبول الطلب.');
        render();
      });
    };
    li.appendChild(b);
    return li;
  }

  function render() {
    $('riderView').hidden = user.role !== 'rider' ? true : false;
    $('driverView').hidden = user.role !== 'driver';
    if (user.role !== 'driver') return;

    var trip = S.myActiveTrip();
    $('tripView').hidden = !trip; $('busyNote').hidden = !trip;
    if (trip) {
      $('tName').textContent = trip.userName;
      $('tFrom').textContent = trip.from + (trip.fromCoords ? ' (موقع الراكب)' : '');
      $('tTo').textContent = trip.to; $('tPax').textContent = paxText(trip.passengers);
      $('tPay').textContent = trip.payment === 'bankak' ? 'بنكك' : 'نقداً';
      $('tFareRow').hidden = !trip.fare; if (trip.fare) $('tFare').textContent = trip.fare.toLocaleString('ar') + ' جنيه';
      $('tNotesRow').hidden = !trip.notes; if (trip.notes) $('tNotes').textContent = trip.notes;
      var tc = trip.fromCoords, ds = [distText(tc), accText(tc), trip.locationAt ? 'حُدِّث ' + ago(trip.locationAt) : ''].filter(Boolean).join(' · ');
      $('tDist').hidden = !ds; $('tDist').textContent = ds;
      $('tMapFrom').textContent = tc ? 'فتح موقع الراكب في الخرائط' : 'ابحث عن «' + trip.from + '» في الخرائط';
      $('tMapFrom').href = mapUrl(tc ? coordQ(tc) : trip.from);
      $('tMapTo').href = mapUrl(trip.to);
    }

    var open = S.openRequests();
    if (S.mySettings().instantOnly) open = open.filter(function (r) { return r.when === 'now'; });   // من الإعدادات
    list.innerHTML = '';
    open.forEach(function (r) { list.appendChild(card(r, !!trip)); });
    $('emptyView').hidden = open.length > 0;
    $('count').hidden = !open.length; $('count').textContent = open.length.toLocaleString('ar');
  }

  $('finishBtn').onclick = function () {
    var t = S.myActiveTrip(); if (!t) { render(); return; }
    S.finishTrip(t.id).then(function (r) {
      window.dispatchEvent(new CustomEvent('waseela:trip-finished', { detail: r }));
      flash('تم إنهاء الرحلة. شكراً لك!'); render();
    }).catch(function () { flash('تعذّر إنهاء الرحلة.'); });
  };

  window.addEventListener('storage', render);          // تحديث فوري من تبويب آخر
  setInterval(function () { if (!document.hidden) render(); }, 10000);
  render();
})();

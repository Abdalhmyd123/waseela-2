(function () {
  var S = WaseelaStore, user = S.currentUser();
  if (!user) { location.replace('login.html'); return; }

  var $ = function (id) { return document.getElementById(id); };
  var form = $('reqForm'), activeView = $('activeView'), driverView = $('driverView');
  var from = $('from'), to = $('to'), fare = $('fare'), whenAt = $('whenAt'), notes = $('notes');
  var btn = $('submit'), formMsg = $('formMsg');
  var pax = 1, coords = null;
  function applyDefaults() { var d = S.mySettings().payment, r = form.querySelector('input[name=pay][value="' + d + '"]'); if (r) r.checked = true; }   // طريقة الدفع المفضّلة من الإعدادات
  applyDefaults();

  /* ---------- أي عرض نُظهر؟ ---------- */
  function render() {
    var act = S.activeRequest();
    driverView.hidden = user.role !== 'driver';
    activeView.hidden = user.role === 'driver' || !act;
    form.hidden = user.role === 'driver' || !!act;
    if (act && user.role !== 'driver') fillActive(act);
  }
  function fmt(iso) {
    try { return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; }
  }
  function fillActive(r) {
    var acc = r.status === 'accepted';
    $('aStatus').textContent = acc ? 'قَبِل الكابتن طلبك' : 'بانتظار سائق';
    $('aTitle').textContent = acc ? 'الكابتن في الطريق إليك' : 'تم إرسال طلبك';
    $('aDriverRow').hidden = !acc; if (acc) $('aDriver').textContent = r.driver.name;
    $('cancelBtn').hidden = acc; document.querySelector('#activeView .hint').hidden = acc;
    $('aFrom').textContent = r.from + (r.fromCoords ? ' (موقعك الحالي)' : '');
    $('shareLoc').textContent = r.fromCoords ? 'حدّث موقعي' : 'شارك موقعي مع الكابتن';
    $('aTo').textContent = r.to;
    $('aPax').textContent = r.passengers + (r.passengers === 1 ? ' راكب' : r.passengers === 2 ? ' راكبان' : ' ركاب');
    $('aWhen').textContent = r.when === 'now' ? 'الآن' : fmt(r.when);
    $('aPay').textContent = r.payment === 'bankak' ? 'بنكك' : 'نقداً';
    $('aFareRow').hidden = !r.fare; if (r.fare) $('aFare').textContent = r.fare.toLocaleString('ar') + ' جنيه';
    $('aNotesRow').hidden = !r.notes; if (r.notes) $('aNotes').textContent = r.notes;
  }

  /* ---------- أدوات النموذج ---------- */
  function setErr(box, el, text) { if (box) $(box).classList.toggle('bad', !!text); $(el).textContent = text || ''; }
  from.addEventListener('input', function () { coords = null; setErr('fromBox', 'fromErr', ''); });
  to.addEventListener('input', function () { setErr('toBox', 'toErr', ''); });
  fare.addEventListener('input', function () { setErr('fareBox', 'fareErr', ''); });
  whenAt.addEventListener('input', function () { setErr('laterBox', 'whenErr', ''); });

  function setPax(n) {
    pax = Math.max(1, Math.min(3, n));                 // الركشة تتسع لثلاثة ركاب
    $('paxOut').textContent = pax;
    $('paxMinus').disabled = pax === 1; $('paxPlus').disabled = pax === 3;
  }
  $('paxMinus').onclick = function () { setPax(pax - 1); };
  $('paxPlus').onclick = function () { setPax(pax + 1); };
  setPax(1);

  /* تعبئة مسبقة من أماكني (?fav=) أو من سجل الرحلات (?again=) */
  (function () {
    var q = new URLSearchParams(location.search), fav = q.get('fav'), again = q.get('again');
    if (fav) {
      var f = S.getFavorite(fav);
      if (f) { from.value = f.from; to.value = f.to; }
    } else if (again) {
      var r = S.getRequest(again);
      if (r) {
        from.value = r.fromCoords ? '' : r.from; to.value = r.to; setPax(r.passengers);
        if (r.fare) fare.value = r.fare;
        var pr = form.querySelector('input[name=pay][value="' + r.payment + '"]'); if (pr) pr.checked = true;
        notes.value = r.notes || '';
      }
    }
  })();

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function localInput(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  Array.prototype.forEach.call(document.querySelectorAll('input[name=when]'), function (r) {
    r.addEventListener('change', function () {
      var later = form.when.value === 'later';
      $('laterBox').hidden = !later;
      if (later) {
        var min = new Date(Date.now() + 15 * 60000);
        whenAt.min = localInput(min);
        if (!whenAt.value) whenAt.value = localInput(new Date(Date.now() + 60 * 60000));
        whenAt.focus();
      } else setErr('laterBox', 'whenErr', '');
    });
  });

  $('locate').onclick = function () {
    var b = this;
    if (!navigator.geolocation) { setErr('fromBox', 'fromErr', 'المتصفح لا يدعم تحديد الموقع. اكتب العنوان يدوياً.'); return; }
    b.disabled = true; b.textContent = 'جارٍ التحديد…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      coords = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5), accuracy: Math.round(pos.coords.accuracy) };
      from.value = 'موقعي الحالي'; setErr('fromBox', 'fromErr', '');
      b.disabled = false; b.textContent = 'موقعي';
    }, function () {
      setErr('fromBox', 'fromErr', 'تعذّر تحديد موقعك. اسمح للمتصفح بالوصول للموقع أو اكتب العنوان يدوياً.');
      b.disabled = false; b.textContent = 'موقعي';
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  /* ---------- الإرسال ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formMsg.className = 'form-msg'; formMsg.textContent = '';
    var f = from.value.trim(), t = to.value.trim(), first = null;
    function bad(box, el, text, field) { setErr(box, el, text); if (!first) first = field; }

    if (f.length < 2) bad('fromBox', 'fromErr', 'اكتب نقطة الانطلاق أو اضغط «موقعي»', from); else setErr('fromBox', 'fromErr', '');
    if (t.length < 2) bad('toBox', 'toErr', 'اكتب وجهتك', to);
    else if (f && f.toLowerCase() === t.toLowerCase()) bad('toBox', 'toErr', 'الوجهة لازم تختلف عن نقطة الانطلاق', to);
    else setErr('toBox', 'toErr', '');

    var fareVal = null;
    if (fare.value !== '') {
      fareVal = Math.round(Number(fare.value));
      if (!(fareVal > 0 && fareVal <= 1000000)) bad('fareBox', 'fareErr', 'اكتب سعراً صحيحاً بالجنيه أو اتركه فارغاً', fare);
      else setErr('fareBox', 'fareErr', '');
    } else setErr('fareBox', 'fareErr', '');

    var when = 'now';
    if (form.when.value === 'later') {
      var d = new Date(whenAt.value);
      if (!whenAt.value || isNaN(d) || d.getTime() < Date.now() + 10 * 60000) bad('laterBox', 'whenErr', 'اختر موعداً بعد 10 دقائق أو أكثر من الآن', whenAt);
      else { when = d.toISOString(); setErr('laterBox', 'whenErr', ''); }
    }
    if (first) { first.focus(); return; }

    btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
    S.createRequest({
      from: f, fromCoords: coords, to: t, passengers: pax, when: when,
      payment: form.pay.value, fare: fareVal, notes: notes.value
    }).then(function (req) {
      window.dispatchEvent(new CustomEvent('waseela:request-created', { detail: req }));
      form.reset(); applyDefaults(); coords = null; setPax(1); $('laterBox').hidden = true;
      render(); window.scrollTo(0, 0);
    }).catch(function (err) {
      formMsg.textContent = err && err.code === 'ACTIVE_EXISTS' ? 'عندك طلب قيد الانتظار بالفعل.' : 'تعذّر إرسال الطلب. جرّب مرة ثانية.';
      if (err && err.code === 'ACTIVE_EXISTS') render();
    }).finally(function () { btn.disabled = false; btn.textContent = 'إرسال الطلب'; });
  });

  $('shareLoc').onclick = function () {
    var b = this, h = $('shareHint'), act = S.activeRequest();
    if (!act) { render(); return; }
    if (!navigator.geolocation) { h.textContent = 'المتصفح لا يدعم تحديد الموقع.'; return; }
    b.disabled = true; var old = b.textContent; b.textContent = 'جارٍ التحديد…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      S.updateRequestLocation(act.id, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }).then(function () {
        h.textContent = 'تمت مشاركة موقعك مع الكابتن.'; b.disabled = false; render();
      }).catch(function () { h.textContent = 'تعذّر حفظ الموقع.'; b.disabled = false; b.textContent = old; });
    }, function () {
      h.textContent = 'تعذّر تحديد موقعك. اسمح للمتصفح بالوصول للموقع وحاول مرة ثانية.'; b.disabled = false; b.textContent = old;
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  $('cancelBtn').onclick = function () {
    var act = S.activeRequest(); if (!act) { render(); return; }
    S.cancelRequest(act.id).then(function () {
      window.dispatchEvent(new CustomEvent('waseela:request-cancelled', { detail: act }));
      render(); window.scrollTo(0, 0);
    }).catch(function () { $('aMsg').textContent = 'تعذّر إلغاء الطلب. جرّب مرة ثانية.'; });
  };

  render();
})();

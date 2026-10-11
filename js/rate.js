(function () {
  var S = WaseelaStore, user = S.currentUser();
  if (!user) { location.replace('login.html'); return; }

  var $ = function (id) { return document.getElementById(id); };
  var form = $('rateForm'), btn = $('submit'), formMsg = $('formMsg');
  var WORDS = { 1: 'سيئة جداً', 2: 'سيئة', 3: 'مقبولة', 4: 'جيدة', 5: 'ممتازة' };
  var GOOD = ['قيادة آمنة', 'وصل في الوقت', 'تعامل محترم', 'ركشة نظيفة', 'التزم بالسعر', 'يعرف الطريق'];
  var BAD  = ['قيادة متهورة', 'تأخر', 'تعامل سيئ', 'ركشة غير نظيفة', 'غيّر السعر', 'لا يعرف الطريق'];
  var trip = null;

  function fmt(iso) {
    try { return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; }
  }
  function show(which) {
    ['driverView', 'emptyView', 'doneView', 'rateForm'].forEach(function (id) { $(id).hidden = id !== which; });
  }
  function starsHtml(n) {
    var out = '';
    for (var i = 1; i <= 5; i++) out += '<span class="' + (i <= n ? 'on' : '') + '">★</span>';
    return out;
  }
  function showDone(r) {
    $('doneText').textContent = 'رأيك في ' + r.driver.name + ' يساعدنا نحافظ على جودة الرحلات.';
    $('doneStars').innerHTML = starsHtml(r.rating.stars);
    show('doneView');
  }

  /* ---------- اختيار الرحلة ---------- */
  function pick() {
    var id = new URLSearchParams(location.search).get('trip');
    if (id) return S.getRequest(id);            // قد تكون مُقيَّمة سابقاً فنعرض الشكر
    var l = S.ratableTrips(); return l.length ? l[0] : null;
  }

  function render() {
    if (user.role === 'driver') return show('driverView');
    trip = pick();
    if (!trip || trip.status !== 'completed' || !trip.driver) return show('emptyView');
    if (trip.rating) return showDone(trip);

    $('cName').textContent = trip.driver.name;
    $('cAvatar').textContent = trip.driver.name.trim().charAt(0);
    $('cTrip').textContent = trip.from + ' ← ' + trip.to + ' · ' + fmt(trip.completedAt || trip.createdAt);
    show('rateForm');
  }

  /* ---------- النجوم ---------- */
  var labels = Array.prototype.slice.call(document.querySelectorAll('#stars label'));
  var chosen = 0, preview = 0;
  function paint() {
    var n = preview || chosen;
    labels.forEach(function (l, i) { l.classList.toggle('on', i < n); });
    $('starWord').textContent = n ? WORDS[n] : 'اضغط على النجوم لتقييم الرحلة';
  }
  labels.forEach(function (l, i) {
    l.addEventListener('mouseenter', function () { preview = i + 1; paint(); });
    l.addEventListener('mouseleave', function () { preview = 0; paint(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name=stars]'), function (r) {
    r.addEventListener('change', function () {
      chosen = +r.value; preview = 0; $('starErr').textContent = ''; paint(); buildChips(chosen);
    });
  });

  /* ---------- الوسوم حسب التقييم ---------- */
  function buildChips(n) {
    var low = n <= 2, list = low ? BAD : GOOD, box = $('chips');
    $('tagsLegend').textContent = low ? 'ما المشكلة؟' : 'ما الذي أعجبك؟';
    box.innerHTML = '';
    list.forEach(function (t) {
      var lab = document.createElement('label'), inp = document.createElement('input'), sp = document.createElement('span');
      lab.className = 'chip'; inp.type = 'checkbox'; inp.value = t; sp.textContent = t;
      lab.appendChild(inp); lab.appendChild(sp); box.appendChild(lab);
    });
    $('tagsWrap').hidden = false;
  }

  /* ---------- الإرسال ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formMsg.className = 'form-msg'; formMsg.textContent = '';
    if (!chosen) { $('starErr').textContent = 'اختر عدد النجوم أولاً'; form.querySelector('input[name=stars]').focus(); return; }
    var tags = Array.prototype.map.call(document.querySelectorAll('#chips input:checked'), function (i) { return i.value; });
    btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
    S.rateTrip(trip.id, { stars: chosen, tags: tags, comment: $('comment').value })
      .then(function (r) {
        window.dispatchEvent(new CustomEvent('waseela:trip-rated', { detail: r }));
        showDone(r); window.scrollTo(0, 0);
      })
      .catch(function (err) {
        if (err && err.code === 'NOT_FOUND') { render(); return; }
        formMsg.textContent = 'تعذّر إرسال التقييم. جرّب مرة ثانية.';
      })
      .finally(function () { btn.disabled = false; btn.textContent = 'إرسال التقييم'; });
  });

  render();
})();

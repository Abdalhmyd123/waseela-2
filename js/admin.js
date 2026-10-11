(function () {
  var S = WaseelaStore;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function num(n) { return Number(n).toLocaleString('ar'); }
  function money(n) { return num(n) + ' جنيه'; }
  function fmt(iso) { try { return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } }
  function say(id, t, ok) { var m = $(id); m.textContent = t; m.className = (m.className.indexOf('form-msg') > -1 ? 'form-msg' : 'msgline') + (ok ? ' ok' : ''); }
  var PLAN = { trial: 'عرض مجاني', day: 'يوم', week: 'أسبوع', month: 'شهر' };
  var METHOD = { bankak: 'بنكك', mycashi: 'ماي كاشي', fawry: 'فوري' };
  var ST = { pending: 'بانتظار سائق', accepted: 'مع الكابتن', completed: 'مكتملة', cancelled: 'ملغية' };
  var PST = { pending: 'قيد المراجعة', approved: 'تم التفعيل', rejected: 'مرفوض' };

  var tab = 'overview', payF = 'pending', uF = 'all', rF = 'all', timer = null;

  /* ---------- البوابة ---------- */
  function showGate() {
    clearInterval(timer);
    $('dash').hidden = true; $('gate').hidden = false;
    $('gateTitle').textContent = 'دخول المسؤول';
    $('gateSub').textContent = 'اكتب اسم المستخدم وكلمة المرور للمتابعة.';
    $('gateBtn').textContent = 'دخول';
    $('gUser').value = S.adminExists() ? S.adminUsername() : '';
    $('gPass').value = ''; ($('gUser').value ? $('gPass') : $('gUser')).focus();
  }
  $('gateForm').onsubmit = function (e) {
    e.preventDefault(); say('gateMsg', '');
    var u = $('gUser').value.trim(), p = $('gPass').value;
    if (!u || !p) { say('gateMsg', 'اكتب اسم المستخدم وكلمة المرور.'); return; }
    S.adminLogin(u, p).then(showDash)
      .catch(function (err) { say('gateMsg', err && err.code === 'INVALID' ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'تعذّر الدخول.'); });
  };
  function guard(err, fallback) {
    if (err && err.code === 'NOT_ADMIN') { showGate(); say('gateMsg', 'انتهت الجلسة. ادخل من جديد.'); return; }
    alert(fallback || 'تعذّر تنفيذ العملية.');
  }
  $('exit').onclick = function () { S.adminLogout(); showGate(); };

  /* ---------- الهيكل ---------- */
  var TABS = [['overview', 'نظرة عامة'], ['payments', 'الدفعات'], ['users', 'المستخدمون'], ['requests', 'الطلبات'], ['settings', 'الإعدادات']];
  function renderTabs() {
    var wrap = $('tabs'), pend = S.adminStats().pendingPayments; wrap.innerHTML = '';
    TABS.forEach(function (t) {
      var b = el('button', 'tab', t[1]); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(tab === t[0]));
      if (t[0] === 'payments' && pend) b.appendChild(el('span', 'n', num(pend)));
      b.onclick = function () { tab = t[0]; render(); window.scrollTo(0, 0); };
      wrap.appendChild(b);
    });
  }
  function chips(wrapId, opts, cur, onPick, name) {
    var wrap = $(wrapId); wrap.innerHTML = '';
    opts.forEach(function (o) {
      var lab = el('label', 'chip'), i = el('input'); i.type = 'radio'; i.name = name; i.value = o[0]; i.checked = cur === o[0];
      i.onchange = function () { onPick(o[0]); };
      lab.appendChild(i); lab.appendChild(el('span', null, o[1])); wrap.appendChild(lab);
    });
  }

  /* ---------- نظرة عامة ---------- */
  function renderOverview() {
    var s = S.adminStats(), g = $('ovGrid'); g.innerHTML = '';
    function card(v, l, cls, go) {
      var c = el('div', 'card' + (cls ? ' ' + cls : '')), inner = go ? el('a') : c;
      if (go) { inner.href = '#'; inner.onclick = function (e) { e.preventDefault(); tab = go; render(); }; c.appendChild(inner); }
      inner.appendChild(el('b', null, v)); inner.appendChild(el('span', null, l)); g.appendChild(c);
    }
    card(num(s.pendingPayments), 'دفعات بانتظار التأكيد', s.pendingPayments ? 'warn' : '', 'payments');
    card(num(s.riders), 'العملاء', '', 'users'); card(num(s.drivers), 'الكباتن', '', 'users');
    card(num(s.activeSubs), 'اشتراكات سارية');
    card(money(s.revenue), 'الإيراد المؤكَّد');
    card(num(s.requests), 'كل الطلبات', '', 'requests'); card(num(s.today), 'طلبات اليوم');
    card(num(s.pending + s.accepted), 'طلبات جارية'); card(num(s.completed), 'مكتملة'); card(num(s.cancelled), 'ملغية');
    card(s.avgRating == null ? '—' : num(s.avgRating.toFixed(1)) + ' ★', s.ratings ? 'متوسط ' + num(s.ratings) + ' تقييم' : 'لا تقييمات');
  }

  /* ---------- الدفعات ---------- */
  function renderPayments() {
    var all = S.adminSubRequests(), pend = all.filter(function (r) { return r.status === 'pending'; }).length;
    chips('payFilters', [['pending', 'بانتظار التأكيد (' + num(pend) + ')'], ['all', 'الكل']], payF, function (v) { payF = v; renderPayments(); }, 'pf');
    var list = all.filter(function (r) { return payF === 'all' || r.status === 'pending'; }), ul = $('payList'); ul.innerHTML = '';
    $('payEmpty').hidden = list.length > 0;
    $('payEmpty').textContent = payF === 'pending' ? 'لا توجد دفعات بانتظار التأكيد.' : 'لا توجد دفعات بعد.';
    list.forEach(function (r) {
      var li = el('li', 'item'), top = el('div', 'top'), who = el('div');
      who.appendChild(el('h3', null, r.userName)); who.appendChild(el('div', 'ph', '+249 ' + r.userPhone));
      top.appendChild(who); top.appendChild(el('span', 'tag ' + r.status, PST[r.status])); li.appendChild(top);
      var m = el('div', 'meta'); m.innerHTML = '';
      [['باقة ', PLAN[r.planId] + ' — ' + money(r.amount)], ['الطريقة: ', METHOD[r.method] || r.method]].forEach(function (x, i) {
        if (i) m.appendChild(document.createTextNode(' · '));
        m.appendChild(document.createTextNode(x[0])); m.appendChild(el('b', null, x[1]));
      });
      li.appendChild(m);
      var ref = el('div', 'meta'); ref.appendChild(document.createTextNode('رقم العملية: ')); var rb = el('b', null, r.ref); rb.dir = 'ltr'; ref.appendChild(rb); li.appendChild(ref);
      li.appendChild(el('div', 'meta', fmt(r.createdAt)));
      if (r.status === 'pending') {
        var a = el('div', 'acts'), ok = el('button', 'btn', 'تأكيد استلام الدفع'), no = el('button', 'btn bad', 'رفض');
        ok.type = no.type = 'button';
        ok.onclick = function () {
          if (!confirm('تأكيد استلام ' + money(r.amount) + ' من ' + r.userName + ' وتفعيل باقة ' + PLAN[r.planId] + '؟')) return;
          S.approveSubRequest(r.id).then(render).catch(function (e) { guard(e); });
        };
        no.onclick = function () { if (confirm('رفض هذا الطلب؟')) S.rejectSubRequest(r.id).then(render).catch(function (e) { guard(e); }); };
        a.appendChild(ok); a.appendChild(no); li.appendChild(a);
      }
      ul.appendChild(li);
    });
  }

  /* ---------- المستخدمون ---------- */
  function renderUsers() {
    chips('uFilters', [['all', 'الكل'], ['rider', 'عملاء'], ['driver', 'كباتن']], uF, function (v) { uF = v; renderUsers(); }, 'uf');
    var q = $('uSearch').value.trim().toLowerCase().replace(/^0+/, '');
    var list = S.adminUsers().filter(function (u) {
      return (uF === 'all' || u.role === uF) && (!q || u.name.toLowerCase().indexOf(q) > -1 || u.phone.indexOf(q) > -1);
    }), ul = $('uList'); ul.innerHTML = '';
    $('uEmpty').hidden = list.length > 0;
    list.forEach(function (u) {
      var li = el('li', 'item'), top = el('div', 'top'), who = el('div');
      who.appendChild(el('h3', null, u.name)); who.appendChild(el('div', 'ph', '+249 ' + u.phone));
      top.appendChild(who); top.appendChild(el('span', 'tag ' + u.role, u.role === 'driver' ? 'كابتن' : 'عميل')); li.appendChild(top);
      li.appendChild(el('div', 'meta', (u.role === 'driver' ? 'رحلات منجزة: ' : 'طلبات: ') + num(u.trips) + ' · انضم ' + fmt(u.createdAt)));
      li.appendChild(el('div', 'meta', 'آخر دخول: ' + fmt(u.lastLoginAt)));
      var acts = el('div', 'acts');
      if (u.role === 'driver') {
        var on = u.sub && u.sub.active;
        li.insertBefore(el('div', 'meta', on ? 'الاشتراك: ' + PLAN[u.sub.planId] + ' حتى ' + fmt(u.sub.expiresAt) : u.sub ? 'الاشتراك: منتهي' : 'الاشتراك: لا يوجد'), acts.parentNode);
        var sel = el('select'); sel.setAttribute('aria-label', 'الباقة');
        ['day', 'week', 'month', 'trial'].forEach(function (p) { var o = el('option', null, PLAN[p]); o.value = p; sel.appendChild(o); });
        var g = el('button', 'btn line', 'تفعيل'); g.type = 'button';
        g.onclick = function () {
          if (!confirm('تفعيل باقة ' + PLAN[sel.value] + ' للكابتن ' + u.name + '؟')) return;
          S.adminGrant(u.phone, sel.value).then(render).catch(function (e) { guard(e); });
        };
        acts.appendChild(sel); acts.appendChild(g);
        if (on) { var rv = el('button', 'btn bad', 'إلغاء الاشتراك'); rv.type = 'button';
          rv.onclick = function () { if (confirm('إلغاء اشتراك ' + u.name + ' الآن؟')) S.adminRevoke(u.phone).then(render).catch(function (e) { guard(e); }); };
          acts.appendChild(rv); }
      }
      var del = el('button', 'btn bad', 'حذف الحساب'); del.type = 'button';
      del.onclick = function () {
        if (!confirm('حذف حساب ' + u.name + ' نهائياً مع طلباته واشتراكه؟ لا يمكن التراجع.')) return;
        S.adminDeleteUser(u.phone).then(render).catch(function (e) { guard(e); });
      };
      acts.appendChild(del); li.appendChild(acts); ul.appendChild(li);
    });
  }
  $('uSearch').oninput = renderUsers;

  /* ---------- الطلبات ---------- */
  function renderRequests() {
    chips('rFilters', [['all', 'الكل'], ['pending', 'بانتظار سائق'], ['accepted', 'مع الكابتن'], ['completed', 'مكتملة'], ['cancelled', 'ملغية']], rF, function (v) { rF = v; renderRequests(); }, 'rf');
    var list = S.adminRequests().filter(function (r) { return rF === 'all' || r.status === rF; }), ul = $('rList'); ul.innerHTML = '';
    $('rEmpty').hidden = list.length > 0;
    list.forEach(function (r) {
      var li = el('li', 'item'), top = el('div', 'top'), who = el('div');
      who.appendChild(el('h3', null, r.userName)); who.appendChild(el('div', 'ph', '+249 ' + r.userPhone));
      top.appendChild(who); top.appendChild(el('span', 'tag ' + r.status, ST[r.status])); li.appendChild(top);
      var route = el('div', 'route');
      route.appendChild(el('i', null, 'من')); route.appendChild(el('b', null, r.from + (r.fromCoords ? ' (موقع العميل)' : '')));
      route.appendChild(el('i', null, 'إلى')); route.appendChild(el('b', null, r.to)); li.appendChild(route);
      li.appendChild(el('div', 'meta', num(r.passengers) + ' ركاب · ' + (r.payment === 'bankak' ? 'بنكك' : 'نقداً') + ' · ' + (r.fare ? money(r.fare) : 'سعر مفتوح') + ' · ' + fmt(r.createdAt)));
      if (r.driver) li.appendChild(el('div', 'meta', 'الكابتن: ' + r.driver.name + (r.rating ? ' — ' + '★'.repeat(r.rating.stars) + '☆'.repeat(5 - r.rating.stars) : '')));
      if (r.cancelledBy === 'admin') li.appendChild(el('div', 'meta', 'أُلغي من الإدارة'));
      if (r.status === 'pending' || r.status === 'accepted') {
        var a = el('div', 'acts'), c = el('button', 'btn bad', 'إلغاء الطلب'); c.type = 'button';
        c.onclick = function () { if (confirm('إلغاء هذا الطلب؟')) S.adminCancelRequest(r.id).then(render).catch(function (e) { guard(e); }); };
        a.appendChild(c); li.appendChild(a);
      }
      ul.appendChild(li);
    });
  }

  /* ---------- الإعدادات ---------- */
  function fillSettings() {
    var c = S.adminConfig(), p = {}, m = {};
    c.plans.forEach(function (x) { p[x.id] = x; }); c.methods.forEach(function (x) { m[x.id] = x; });
    $('cDay').value = p.day.price; $('cWeek').value = p.week.price; $('cMonth').value = p.month.price; $('cTrial').value = p.trial.days;
    $('aBankak').value = m.bankak.account; $('aMycashi').value = m.mycashi.account; $('aFawry').value = m.fawry.account;
  }
  $('cfgForm').onsubmit = function (e) {
    e.preventDefault(); say('cfgMsg', '');
    S.adminSaveConfig({ prices: { day: $('cDay').value, week: $('cWeek').value, month: $('cMonth').value }, trialDays: $('cTrial').value,
      accounts: { bankak: $('aBankak').value, mycashi: $('aMycashi').value, fawry: $('aFawry').value } })
      .then(function () { fillSettings(); say('cfgMsg', 'تم حفظ الإعدادات.', true); })
      .catch(function (err) {
        if (err && err.code === 'NOT_ADMIN') return guard(err);
        say('cfgMsg', err && err.code === 'INVALID_PRICE' ? 'اكتب أسعاراً صحيحة بالجنيه (أرقام أكبر من صفر).' : err && err.code === 'INVALID_TRIAL' ? 'مدة العرض المجاني من 1 إلى 30 يوماً.' : 'تعذّر الحفظ.');
      });
  };
  $('pwForm').onsubmit = function (e) {
    e.preventDefault(); say('pwMsg', '');
    var u = $('pUser').value.trim(), np = $('pNew').value;
    if (!$('pOld').value) { say('pwMsg', 'اكتب كلمة المرور الحالية.'); return; }
    if (u.length < 3 || u.length > 30 || /\s/.test(u)) { say('pwMsg', 'اسم المستخدم من 3 إلى 30 حرفاً بدون مسافات.'); return; }
    if (np && np.length < 8) { say('pwMsg', 'كلمة المرور الجديدة لازم تكون 8 أحرف أو أكثر.'); return; }
    S.adminUpdateCredentials($('pOld').value, u, np).then(function () {
      $('pOld').value = $('pNew').value = ''; $('defaultWarn').hidden = !S.adminIsDefault();
      say('pwMsg', 'تم حفظ بيانات الدخول.', true);
    }).catch(function (err) {
      if (err && err.code === 'NOT_ADMIN') return guard(err);
      say('pwMsg', err && err.code === 'INVALID' ? 'كلمة المرور الحالية غير صحيحة.' : err && err.code === 'BAD_USER' ? 'اسم المستخدم غير صالح.' : err && err.code === 'WEAK' ? 'كلمة المرور الجديدة قصيرة.' : 'تعذّر الحفظ.');
    });
  };

  /* ---------- العرض ---------- */
  function render() {
    if (!S.isAdmin()) { showGate(); return; }
    renderTabs();
    TABS.forEach(function (t) { $('t-' + t[0]).hidden = t[0] !== tab; });
    if (tab === 'overview') renderOverview();
    else if (tab === 'payments') renderPayments();
    else if (tab === 'users') renderUsers();
    else if (tab === 'requests') renderRequests();
  }
  function showDash() {
    $('gate').hidden = true; $('dash').hidden = false; tab = 'overview'; fillSettings(); $('pUser').value = S.adminUsername(); $('defaultWarn').hidden = !S.adminIsDefault(); render();
    clearInterval(timer);
    timer = setInterval(function () { if (!document.hidden && tab !== 'settings' && tab !== 'users') render(); }, 15000);   // تحديث دوري (وفحص انتهاء الجلسة)
  }

  if (S.isAdmin()) showDash(); else showGate();
})();

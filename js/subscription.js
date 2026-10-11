(function () {
  var S = WaseelaStore, user = S.currentUser();
  if (!user) { location.replace('login.html'); return; }

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(iso) { try { return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } }
  function money(n) { return n.toLocaleString('ar') + ' جنيه'; }
  function days(n) { return n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n <= 10 ? n.toLocaleString('ar') + ' أيام' : n.toLocaleString('ar') + ' يوماً'; }
  function planOf(id) { return S.PLANS.filter(function (p) { return p.id === id; })[0]; }
  function methodOf(id) { return S.PAY_METHODS.filter(function (m) { return m.id === id; })[0]; }

  var msg = $('msg'), selPlan = null, selMethod = S.PAY_METHODS[0].id;
  function flash(t, ok) { msg.textContent = t; msg.className = 'form-msg' + (ok ? ' ok' : ''); }

  /* ---------- الحالة الحالية ---------- */
  function renderState() {
    var sub = S.mySubscription(), pend = S.pendingSubRequest(), box = $('stateBox'), tag = $('stateTag');
    var on = !!sub && sub.active;
    box.classList.toggle('on', on); tag.classList.toggle('on', on);
    if (on) {
      var p = planOf(sub.planId);
      tag.textContent = 'اشتراك ساري';
      $('stateTitle').textContent = 'باقة ' + (p ? p.name : '');
      $('stateText').textContent = 'ينتهي في ' + fmt(sub.expiresAt) + '. يمكنك التجديد وسيُضاف إلى المدة المتبقية.';
    } else {
      tag.textContent = sub ? 'منتهي' : 'غير مشترك';
      $('stateTitle').textContent = sub ? 'انتهى اشتراكك' : 'لا يوجد اشتراك';
      $('stateText').textContent = pend ? 'طلبك قيد المراجعة، وسيُفعَّل بعد تأكيد الإدارة للدفع.' : 'اختر باقة من الأسفل لتبدأ.';
    }
  }

  /* ---------- الباقات ---------- */
  function renderPlans() {
    var wrap = $('plans'); wrap.innerHTML = '';
    var used = S.trialUsed();
    if (!selPlan) selPlan = used ? 'day' : 'trial';
    if (used && selPlan === 'trial') selPlan = 'day';
    S.PLANS.forEach(function (p) {
      var free = p.price === 0, lab = el('label', 'plan' + (free ? ' free' : ''));
      var inp = el('input'); inp.type = 'radio'; inp.name = 'plan'; inp.value = p.id;
      inp.checked = p.id === selPlan; inp.disabled = free && used;
      inp.onchange = function () { selPlan = p.id; flash(''); renderPay(); };
      var box = el('span', 'pbox'), nm = el('span', 'nm', p.name);
      nm.appendChild(el('small', null, free ? (used ? 'تم استخدامه سابقاً' : 'جرّب مجاناً لمدة ' + days(p.days)) : days(p.days)));
      box.appendChild(nm); box.appendChild(el('span', 'pr', free ? 'مجاناً' : money(p.price)));
      lab.appendChild(inp); lab.appendChild(box); wrap.appendChild(lab);
    });
  }

  /* ---------- الدفع ---------- */
  function renderMethods() {
    var wrap = $('methods'); wrap.innerHTML = '';
    S.PAY_METHODS.forEach(function (m) {
      var lab = el('label', 'opt'), inp = el('input'); inp.type = 'radio'; inp.name = 'method'; inp.value = m.id; inp.checked = m.id === selMethod;
      inp.onchange = function () { selMethod = m.id; renderPay(); };
      lab.appendChild(inp); lab.appendChild(el('span', null, m.name)); wrap.appendChild(lab);
    });
  }
  function renderPay() {
    var plan = planOf(selPlan), free = !plan || plan.price === 0, pend = S.pendingSubRequest();
    $('trialBtn').hidden = !(plan && free && !S.trialUsed());
    $('payView').hidden = free;
    if (free) return;
    var m = methodOf(selMethod), acc = m.account;
    $('pAmount').textContent = money(plan.price);
    $('pAccLabel').textContent = 'رقم ' + m.name;
    $('pAcc').textContent = acc || '—';
    $('copyBtn').hidden = !acc; $('accWarn').hidden = !!acc;
    $('sendBtn').disabled = !!pend || !acc;
    $('sendBtn').textContent = pend ? 'لديك طلب قيد المراجعة' : 'إرسال الطلب';
  }

  $('copyBtn').onclick = function () {
    var acc = methodOf(selMethod).account, b = $('copyBtn');
    function done() { b.textContent = 'تم النسخ'; setTimeout(function () { b.textContent = 'نسخ'; }, 1500); }
    try { navigator.clipboard.writeText(acc).then(done, function () {}); } catch (e) {}
  };

  $('trialBtn').onclick = function () {
    var b = $('trialBtn'); b.disabled = true; flash('');
    S.startTrial().then(function () {
      flash('تم تفعيل العرض المجاني. بالتوفيق!', true); renderAll();
    }).catch(function (e) {
      flash(e && e.code === 'TRIAL_USED' ? 'العرض المجاني يُستخدم مرة واحدة فقط.' : 'تعذّر تفعيل العرض.'); renderAll();
    }).then(function () { b.disabled = false; });
  };

  $('sendBtn').onclick = function () {
    var b = $('sendBtn'), ref = $('ref').value;
    if (String(ref).trim().length < 4) { flash('اكتب رقم العملية أو رقم الهاتف المحوَّل منه.'); $('ref').focus(); return; }
    b.disabled = true; flash('');
    S.requestSubscription({ planId: selPlan, method: selMethod, ref: ref }).then(function () {
      $('ref').value = ''; flash('تم إرسال الطلب. سيُفعَّل اشتراكك بعد تأكيد الإدارة.', true); renderAll();
    }).catch(function (e) {
      flash(e && e.code === 'PENDING_EXISTS' ? 'لديك طلب قيد المراجعة بالفعل.' : 'تعذّر إرسال الطلب.'); renderAll();
    });
  };

  /* ---------- سجل الطلبات ---------- */
  function renderHist() {
    var list = S.mySubRequests().slice(0, 6), ul = $('hist'); ul.innerHTML = '';
    $('histView').hidden = !list.length;
    list.forEach(function (r) {
      var p = planOf(r.planId), li = el('li'), top = el('div', 'top');
      top.appendChild(el('span', null, 'باقة ' + (p ? p.name : '') + ' — ' + money(r.amount)));
      top.appendChild(el('span', 'b-' + r.status, r.status === 'pending' ? 'قيد المراجعة' : r.status === 'approved' ? 'تم التفعيل' : 'مرفوض'));
      li.appendChild(top);
      li.appendChild(el('div', 'meta', (methodOf(r.method) || {}).name + ' · ' + fmt(r.createdAt)));
      ul.appendChild(li);
    });
  }

  function renderAll() { renderState(); renderPlans(); renderPay(); renderHist(); }

  if (user.role !== 'driver') { $('riderView').hidden = false; return; }
  $('driverView').hidden = false;
  renderMethods(); renderAll();
  window.addEventListener('storage', renderAll);
})();

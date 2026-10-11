(function () {
  var S = WaseelaStore, user = S.currentUser();
  if (!user) { location.replace('login.html'); return; }

  var $ = function (id) { return document.getElementById(id); };
  var driver = user.role === 'driver';
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function say(id, t, ok) { var m = $(id); m.textContent = t; m.className = 'form-msg' + (ok ? ' ok' : ''); }
  function fmt(iso) { try { return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } }
  function num(n) { return Number(n).toLocaleString('ar'); }

  /* ---------- الرأس ---------- */
  function renderHead() {
    var u = S.currentUser();
    $('avatar').textContent = (u.name.trim().charAt(0) || '؟');
    $('pName').textContent = u.name;
    $('pPhone').textContent = '+249 ' + u.phone;
    $('pRole').textContent = driver ? 'كابتن' : 'عميل';
    $('pRole').className = 'role' + (driver ? ' driver' : '');
  }
  function stat(v, l) { var d = el('div', 'stat'); d.appendChild(el('b', null, v)); d.appendChild(el('span', null, l)); return d; }
  function renderStats() {
    var st = S.myStats(), box = $('stats'); box.innerHTML = '';
    box.appendChild(stat(num(st.trips), 'رحلة مكتملة'));
    if (driver) box.appendChild(stat(st.avg == null ? '—' : num(st.avg.toFixed(1)) + ' ★', st.ratings ? 'متوسط ' + num(st.ratings) + ' تقييم' : 'لا تقييمات بعد'));
    else box.appendChild(stat(num(st.cancelled), 'طلب ملغي'));
    box.appendChild(stat(new Date(user.createdAt).toLocaleDateString('ar', { month: 'short', year: 'numeric' }), 'عضو منذ'));
  }
  function renderSub() {
    $('subCard').hidden = !driver; if (!driver) return;
    var s = S.mySubscription();
    $('subText').textContent = s && s.active ? 'ساري حتى ' + fmt(s.expiresAt) : s ? 'انتهى اشتراكك — جدّده الآن' : 'غير مشترك — جرّب العرض المجاني';
  }

  /* ---------- البيانات ---------- */
  var cfg = S.mySettings();
  $('name').value = user.name; $('phoneRo').value = '+249 ' + user.phone;
  $('driverFields').hidden = !driver;
  $('vehicle').value = cfg.vehicle; $('plate').value = cfg.plate;

  $('infoForm').onsubmit = function (e) {
    e.preventDefault(); say('infoMsg', '');
    var jobs = [S.updateName($('name').value)];
    if (driver) jobs.push(S.saveSettings({ vehicle: $('vehicle').value.trim(), plate: $('plate').value.trim().toUpperCase() }));
    Promise.all(jobs).then(function () {
      user = S.currentUser(); $('name').value = user.name; renderHead(); say('infoMsg', 'تم حفظ التعديلات.', true);
    }).catch(function (err) {
      say('infoMsg', err && err.code === 'INVALID_NAME' ? 'اكتب اسمك الكامل (3 أحرف على الأقل).' : 'تعذّر الحفظ.');
    });
  };

  /* ---------- الإعدادات (تُحفظ فور التغيير) ---------- */
  var flashT;
  function saved() { say('setMsg', 'تم الحفظ.', true); clearTimeout(flashT); flashT = setTimeout(function () { say('setMsg', '', true); }, 1800); }
  if (!driver) {
    $('payGroup').hidden = false;
    var r = document.querySelector('input[name=pay][value="' + cfg.payment + '"]'); if (r) r.checked = true;
    Array.prototype.forEach.call(document.querySelectorAll('input[name=pay]'), function (i) {
      i.onchange = function () { S.saveSettings({ payment: i.value }).then(saved); };
    });
  } else {
    $('instantRow').hidden = false; $('instant').checked = cfg.instantOnly;
    $('instant').onchange = function () { S.saveSettings({ instantOnly: $('instant').checked }).then(saved); };
  }

  /* ---------- كلمة المرور ---------- */
  var hasPass = S.hasPassword();   // الحسابات المنشأة بالاسم والهاتف فقط ليس لها كلمة مرور بعد
  function syncPassUI() {
    $('oldPassField').hidden = !hasPass;
    $('delPassBox').hidden = !hasPass;
    $('passBtn').textContent = hasPass ? 'تغيير كلمة المرور' : 'إضافة كلمة مرور';
    $('newPass').closest('.field').querySelector('label').textContent = hasPass ? 'كلمة المرور الجديدة' : 'كلمة المرور (اختياري)';
  }
  syncPassUI();
  $('passForm').onsubmit = function (e) {
    e.preventDefault(); say('passMsg', '');
    var o = $('oldPass').value, n = $('newPass').value;
    if (hasPass && !o) { say('passMsg', 'اكتب كلمة المرور الحالية.'); $('oldPass').focus(); return; }
    if (n.length < 6) { say('passMsg', 'كلمة المرور الجديدة لازم تكون 6 أحرف أو أكثر.'); $('newPass').focus(); return; }
    S.changePassword(o, n).then(function () {
      $('oldPass').value = $('newPass').value = ''; say('passMsg', hasPass ? 'تم تغيير كلمة المرور.' : 'تمت إضافة كلمة المرور.', true);
      hasPass = true; syncPassUI();
    }).catch(function (err) {
      say('passMsg', err && err.code === 'WRONG_OLD' ? 'كلمة المرور الحالية غير صحيحة.' : 'تعذّر تغيير كلمة المرور.');
    });
  };

  /* ---------- الخروج والحذف ---------- */
  $('logout').onclick = function () { S.logout(); location.href = 'login.html'; };
  $('delForm').onsubmit = function (e) {
    e.preventDefault(); say('delMsg', '');
    if (hasPass && !$('delPass').value) { say('delMsg', 'اكتب كلمة المرور للتأكيد.'); return; }
    if (!confirm('هل أنت متأكد؟ لا يمكن التراجع عن حذف الحساب.')) return;
    S.deleteAccount($('delPass').value).then(function () { location.href = 'login.html#signup'; })
      .catch(function (err) { say('delMsg', err && err.code === 'WRONG_OLD' ? 'كلمة المرور غير صحيحة.' : 'تعذّر حذف الحساب.'); });
  };

  renderHead(); renderStats(); renderSub();
  window.addEventListener('storage', function () { renderStats(); renderSub(); });
})();

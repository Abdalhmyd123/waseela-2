(function () {
  var S = WaseelaStore;
  var $ = function (id) { return document.getElementById(id); };
  var phone = $('phone'), pass = $('pass'), btn = $('submit'), formMsg = $('formMsg');
  var sName = $('sName'), sPhone = $('sPhone'), sBtn = $('sSubmit'), sMsg = $('sFormMsg');

  if (S.currentUser()) { location.replace('home.html'); return; }   // مسجَّل دخوله بالفعل
  phone.value = S.getLastPhone();                                   // آخر رقم استُخدم

  function setErr(box, el, html) { $(box).classList.toggle('bad', !!html); $(el).innerHTML = html || ''; }

  /* ---------- التبديل بين الدخول وإنشاء الحساب ---------- */
  var TEXT = {
    login:  { title: 'تسجيل الدخول', sub: 'ادخل برقم هاتفك وأطلب ركشتك.', foot: 'ما عندك حساب؟', btn: 'إنشاء حساب', doc: 'تسجيل الدخول — وسيلة' },
    signup: { title: 'إنشاء حساب', sub: 'الاسم ورقم الهاتف فقط، وتبدأ مباشرة.', foot: 'عندك حساب؟', btn: 'تسجيل الدخول', doc: 'إنشاء حساب — وسيلة' }
  };
  function show(mode, focus) {
    var isLogin = mode === 'login', t = TEXT[mode];
    $('login').hidden = !isLogin; $('signup').hidden = isLogin;
    $('tabLogin').setAttribute('aria-selected', isLogin); $('tabSignup').setAttribute('aria-selected', !isLogin);
    $('title').textContent = t.title; $('sub').textContent = t.sub;
    $('footP').textContent = t.foot; $('footBtn').textContent = t.btn; document.title = t.doc;
    if (focus) (isLogin ? phone : sName).focus();
    if (history.replaceState) history.replaceState(null, '', isLogin ? location.pathname : '#signup');
  }
  $('tabLogin').onclick = function () { show('login', true); };
  $('tabSignup').onclick = function () { show('signup', true); };
  $('footBtn').onclick = function () { show($('login').hidden ? 'login' : 'signup', true); window.scrollTo(0, 0); };
  show(location.hash === '#signup' ? 'signup' : 'login', false);
  window.addEventListener('hashchange', function () { show(location.hash === '#signup' ? 'signup' : 'login', false); });

  /* ---------- الدخول ---------- */
  // حقل كلمة المرور يظهر فقط عند الحاجة: حساب محميّ بكلمة مرور، أو دخول المسؤول
  function isAdminName(v) { v = v.trim(); return !!v && !S.isValidPhone(S.normalizePhone(v)) && v.toLowerCase() === String(S.adminUsername()).toLowerCase(); }
  function needsPass() { return isAdminName(phone.value) || S.phoneStatus(phone.value) === 'pass'; }
  function syncPass() { $('passField').hidden = !needsPass(); }
  syncPass();

  $('toggle').onclick = function () {
    var shown = pass.type === 'password';
    pass.type = shown ? 'text' : 'password';
    this.textContent = shown ? 'إخفاء' : 'إظهار';
    this.setAttribute('aria-pressed', shown);
  };
  phone.addEventListener('input', function () { setErr('phoneBox', 'phoneErr', ''); formMsg.textContent = ''; syncPass(); });
  pass.addEventListener('input', function () { setErr('passBox', 'passErr', ''); formMsg.textContent = ''; });

  function loginFail(msg) { btn.disabled = false; btn.textContent = 'تسجيل الدخول'; formMsg.className = 'form-msg'; formMsg.textContent = msg; }

  $('login').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = S.normalizePhone(phone.value);
    formMsg.className = 'form-msg'; formMsg.textContent = '';

    // دخول المسؤول: اسم المسؤول بدل رقم الهاتف
    if (isAdminName(phone.value)) {
      if (!pass.value) { syncPass(); setErr('passBox', 'passErr', 'اكتب كلمة المرور'); pass.focus(); return; }
      btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
      S.adminLogin(phone.value.trim(), pass.value).then(function () { location.href = 'admin.html'; })
        .catch(function () { loginFail('رقم الهاتف أو كلمة المرور غير صحيحة. جرّب مرة ثانية.'); });
      return;
    }
    if (!S.isValidPhone(p)) { setErr('phoneBox', 'phoneErr', 'اكتب رقم الهاتف من 9 أرقام، مثال: 912345678'); phone.focus(); return; }
    setErr('phoneBox', 'phoneErr', '');

    var st = S.phoneStatus(p);
    if (st === 'none') {
      setErr('phoneBox', 'phoneErr', 'هذا الرقم غير مسجَّل. <a href="#signup" id="goSignup">أنشئ حساباً بالاسم والهاتف</a>');
      var g = $('goSignup'); if (g) g.onclick = function (ev) { ev.preventDefault(); sPhone.value = phone.value; show('signup', true); };
      return;
    }
    if (st === 'pass' && !pass.value) { syncPass(); setErr('passBox', 'passErr', 'اكتب كلمة المرور'); pass.focus(); return; }

    btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
    S.login(p, pass.value).then(function (user) {
      formMsg.className = 'form-msg ok'; formMsg.textContent = 'تم تسجيل الدخول';
      window.dispatchEvent(new CustomEvent('waseela:login-success', { detail: user }));
      setTimeout(function () { location.href = 'home.html'; }, 500);
    }).catch(function (err) {
      loginFail(err && err.code === 'INVALID' ? 'رقم الهاتف أو كلمة المرور غير صحيحة. جرّب مرة ثانية.' : 'تعذّر تسجيل الدخول. جرّب مرة ثانية.');
    });
  });

  /* ---------- إنشاء حساب: الاسم + الهاتف + راكب/سائق ---------- */
  sName.addEventListener('input', function () { setErr('sNameBox', 'sNameErr', ''); sMsg.textContent = ''; });
  sPhone.addEventListener('input', function () { setErr('sPhoneBox', 'sPhoneErr', ''); sMsg.textContent = ''; });

  $('signup').addEventListener('submit', function (e) {
    e.preventDefault();
    sMsg.className = 'form-msg'; sMsg.textContent = '';
    var name = sName.value.trim().replace(/\s+/g, ' ');
    var p = S.normalizePhone(sPhone.value), first = null;
    if (name.length < 3) { setErr('sNameBox', 'sNameErr', 'اكتب اسمك (3 أحرف على الأقل)'); first = sName; } else setErr('sNameBox', 'sNameErr', '');
    if (!S.isValidPhone(p)) { setErr('sPhoneBox', 'sPhoneErr', 'اكتب رقم الهاتف من 9 أرقام، مثال: 912345678'); if (!first) first = sPhone; } else setErr('sPhoneBox', 'sPhoneErr', '');
    if (first) { first.focus(); return; }

    var role = document.querySelector('#signup input[name=role]:checked').value;
    sBtn.disabled = true; sBtn.textContent = 'جارٍ إنشاء الحساب…';
    S.register({ name: name, phone: p, role: role }).then(function (user) {
      sMsg.className = 'form-msg ok'; sMsg.textContent = 'تم إنشاء حسابك. أهلاً بك يا ' + user.name.split(' ')[0];
      window.dispatchEvent(new CustomEvent('waseela:signup-success', { detail: user }));
      setTimeout(function () { location.href = 'home.html'; }, 800);
    }).catch(function (err) {
      sBtn.disabled = false; sBtn.textContent = 'إنشاء الحساب';
      if (err && err.code === 'PHONE_EXISTS') {
        setErr('sPhoneBox', 'sPhoneErr', 'هذا الرقم مسجَّل من قبل. <a href="#login" id="goLogin">سجّل الدخول</a>');
        var g = $('goLogin'); if (g) g.onclick = function (ev) { ev.preventDefault(); phone.value = sPhone.value; syncPass(); show('login', true); };
        sPhone.focus();
      } else sMsg.textContent = 'تعذّر إنشاء الحساب. جرّب مرة ثانية.';
    });
  });
})();

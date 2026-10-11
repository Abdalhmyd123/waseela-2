/* طبقة التخزين المحلي المشتركة (localStorage) — تُحمَّل في كل الصفحات.
   المفاتيح:
     waseela:users      كل الحسابات { "912345678": {...} }
     waseela:session    الحساب المسجَّل دخوله حالياً
     waseela:lastPhone  آخر رقم استُخدم (لتعبئته في صفحة الدخول)
     waseela:requests   طلبات الركشة [ {...} ]
     waseela:settings   إعدادات كل حساب { "912345678": { payment, instantOnly } } + ملف الكابتن { vehicle }
     waseela:favorites  أماكني: المشاوير المفضلة لكل عميل { "912345678": [ { id, label, from, to } ] }
     waseela:admin      بيانات دخول المسؤول { username, salt, hash, algo, isDefault } (كلمة المرور مشفّرة؛ الحساب الافتراضي Admin / Admin يُنشأ تلقائياً عند أول دخول ويمكن تغييره من الإعدادات)
     waseela:adminSession جلسة المسؤول { at }
     waseela:config     ما تعدّله الإدارة: { prices:{day,week,month}, trialDays, accounts:{bankak,mycashi,fawry} }
     waseela:subs       اشتراكات الكباتن { "912345678": { planId, startedAt, expiresAt, trialUsed } }
     waseela:subRequests طلبات الاشتراك المدفوعة بانتظار تأكيد الإدارة [ {...} ]
   كلمة المرور لا تُحفظ نصاً: تُحفظ مشفّرة (PBKDF2) مع salt خاص بكل حساب. */
(function (global) {
  'use strict';
  var K = { users: 'waseela:users', session: 'waseela:session', last: 'waseela:lastPhone', requests: 'waseela:requests', subs: 'waseela:subs', subReqs: 'waseela:subRequests', settings: 'waseela:settings', favs: 'waseela:favorites', admin: 'waseela:admin', adminSession: 'waseela:adminSession', config: 'waseela:config' };
  var mem = {};            // احتياطي إذا كان localStorage معطّلاً (وضع التصفح الخاص مثلاً)
  var persistent = true;

  function read(key, def) {
    try { var v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); }
    catch (e) { persistent = false; return key in mem ? mem[key] : def; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { persistent = false; mem[key] = val; return false; }
  }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) {} delete mem[key]; }

  /* ---------- الهاتف ---------- */
  function normalizePhone(v) {
    v = String(v || '').replace(/[\u0660-\u0669]/g, function (d) { return d.charCodeAt(0) - 0x660; });
    v = v.replace(/\D/g, '');
    if (v.indexOf('249') === 0 && v.length > 9) v = v.slice(3);
    return v.replace(/^0+/, '');
  }
  function isValidPhone(p) { return /^[19]\d{8}$/.test(p); }

  /* ---------- التشفير ---------- */
  function randomHex(bytes) {
    var a = new Uint8Array(bytes);
    if (global.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function toHex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function hashPassword(password, salt, algo) {
    if (algo === 'pbkdf2' && global.crypto && crypto.subtle) {
      var enc = new TextEncoder();
      return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
        .then(function (key) {
          return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
        }).then(toHex);
    }
    // احتياطي ضعيف للمتصفحات بلا crypto.subtle (غير آمن — للتجربة فقط)
    var s = salt + password, h = 2166136261;
    for (var r = 0; r < 2000; r++) for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return Promise.resolve(h.toString(16));
  }
  function bestAlgo() { return (global.crypto && crypto.subtle) ? 'pbkdf2' : 'fnv'; }

  /* ---------- الحسابات ---------- */
  function fail(code) { var e = new Error(code); e.code = code; return Promise.reject(e); }
  function publicUser(u) {
    if (!u) return null;
    return { id: u.id, name: u.name, phone: u.phone, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt };
  }
  function setSession(u) { write(K.session, { phone: u.phone, at: new Date().toISOString() }); write(K.last, u.phone); }

  function register(data) {
    var phone = normalizePhone(data.phone);
    if (!isValidPhone(phone)) return fail('INVALID_PHONE');
    var users = read(K.users, {});
    if (users[phone]) return fail('PHONE_EXISTS');
    var hasPass = !!data.password;           // كلمة المرور اختيارية: التسجيل يكفيه الاسم ورقم الهاتف
    var salt = hasPass ? randomHex(16) : null, algo = bestAlgo();
    return (hasPass ? hashPassword(data.password, salt, algo) : Promise.resolve(null)).then(function (hash) {
      var now = new Date().toISOString();
      var user = {
        id: 'u_' + randomHex(6), name: String(data.name).trim(), phone: phone,
        role: data.role === 'driver' ? 'driver' : 'rider',
        salt: salt, hash: hash, algo: algo, noPass: !hasPass, createdAt: now, lastLoginAt: now
      };
      users = read(K.users, {});          // إعادة القراءة تحسباً لتبويب آخر
      if (users[phone]) throw Object.assign(new Error('PHONE_EXISTS'), { code: 'PHONE_EXISTS' });
      users[phone] = user;
      write(K.users, users);
      setSession(user);
      return publicUser(user);
    });
  }

  /* هل هذا الرقم مسجَّل؟ وهل حسابه محميّ بكلمة مرور؟ (لصفحة الدخول) */
  function phoneStatus(phoneRaw) {
    var u = read(K.users, {})[normalizePhone(phoneRaw)];
    return !u ? 'none' : (u.noPass ? 'nopass' : 'pass');
  }
  function hasPassword() {
    var s = read(K.session, null); if (!s) return false;
    var u = read(K.users, {})[s.phone]; return !!u && !u.noPass;
  }

  function login(phoneRaw, password) {
    var phone = normalizePhone(phoneRaw);
    var users = read(K.users, {}), user = users[phone];
    if (!user) return fail('INVALID');
    return (user.noPass ? Promise.resolve(null) : hashPassword(password, user.salt, user.algo)).then(function (hash) {
      if (!user.noPass && hash !== user.hash) throw Object.assign(new Error('INVALID'), { code: 'INVALID' });
      user.lastLoginAt = new Date().toISOString();
      users[phone] = user; write(K.users, users);
      setSession(user);
      return publicUser(user);
    });
  }

  function currentUser() {
    var s = read(K.session, null);
    if (!s) return null;
    return publicUser(read(K.users, {})[s.phone]);
  }
  function logout() { remove(K.session); }

  /* ---------- الطلبات ---------- */
  function allRequests() { return read(K.requests, []); }
  function myRequests() {
    var u = currentUser();
    if (!u) return [];
    return allRequests().filter(function (r) { return r.userPhone === u.phone; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }
  function activeRequest() {
    var l = myRequests().filter(function (r) { return r.status === 'pending' || r.status === 'accepted'; });
    l.sort(function (a, b) { return (a.status === 'accepted' ? 0 : 1) - (b.status === 'accepted' ? 0 : 1); });
    return l.length ? l[0] : null;
  }
  function createRequest(d) {
    var u = currentUser();
    if (!u) return fail('NO_SESSION');
    if (activeRequest()) return fail('ACTIVE_EXISTS');
    var req = {
      id: 'r_' + randomHex(6), userPhone: u.phone, userName: u.name,
      from: String(d.from).trim(), fromCoords: d.fromCoords || null, to: String(d.to).trim(),
      passengers: d.passengers, when: d.when || 'now', payment: d.payment === 'bankak' ? 'bankak' : 'cash',
      fare: d.fare || null, notes: String(d.notes || '').trim(),
      status: 'pending', createdAt: new Date().toISOString()
    };
    var list = allRequests(); list.push(req); write(K.requests, list);
    return Promise.resolve(req);
  }
  /* رحلة مكتملة: تُستدعى من لوحة السائق عند إنهاء الرحلة. driver = { name, phone } */
  function completeRequest(id, driver) {
    var list = allRequests(), hit = null;
    list.forEach(function (r) {
      if (r.id === id && (r.status === 'pending' || r.status === 'accepted')) {
        r.status = 'completed'; r.completedAt = new Date().toISOString();
        r.driver = { name: String((driver && driver.name) || 'الكابتن'), phone: (driver && driver.phone) || null };
        hit = r;
      }
    });
    if (!hit) return fail('NOT_FOUND');
    write(K.requests, list);
    return Promise.resolve(hit);
  }
  function getRequest(id) {
    var l = myRequests().filter(function (r) { return r.id === id; });
    return l.length ? l[0] : null;
  }
  /* الرحلات المكتملة التي لم تُقيَّم بعد */
  function ratableTrips() {
    return myRequests().filter(function (r) { return r.status === 'completed' && r.driver && !r.rating; });
  }
  /* d = { stars: 1..5, tags: [..], comment: '' } */
  function rateTrip(id, d) {
    var u = currentUser(); if (!u) return fail('NO_SESSION');
    var stars = Math.round(Number(d && d.stars));
    if (!(stars >= 1 && stars <= 5)) return fail('INVALID_STARS');
    var list = allRequests(), hit = null;
    list.forEach(function (r) {
      if (r.id === id && r.userPhone === u.phone && r.status === 'completed' && r.driver && !r.rating) {
        r.rating = {
          stars: stars,
          tags: (d.tags || []).map(String).slice(0, 8),
          comment: String(d.comment || '').trim().slice(0, 300),
          at: new Date().toISOString()
        };
        hit = r;
      }
    });
    if (!hit) return fail('NOT_FOUND');
    write(K.requests, list);
    return Promise.resolve(hit);
  }

  /* ---------- جانب الكابتن ---------- */
  function isDriver() { var u = currentUser(); return !!u && u.role === 'driver'; }
  /* الطلبات المتاحة: بانتظار سائق، الأحدث أولاً (الفوري قبل المجدول) */
  function openRequests() {
    if (!isDriver()) return [];
    return allRequests().filter(function (r) { return r.status === 'pending'; })
      .sort(function (a, b) {
        var an = a.when === 'now' ? 0 : 1, bn = b.when === 'now' ? 0 : 1;
        if (an !== bn) return an - bn;
        return a.createdAt < b.createdAt ? 1 : -1;
      });
  }
  function myActiveTrip() {
    var u = currentUser(); if (!u || u.role !== 'driver') return null;
    var l = allRequests().filter(function (r) { return r.status === 'accepted' && r.driver && r.driver.phone === u.phone; });
    return l.length ? l[0] : null;
  }
  function acceptRequest(id) {
    var u = currentUser();
    if (!u || u.role !== 'driver') return fail('NOT_DRIVER');
    if (myActiveTrip()) return fail('DRIVER_BUSY');
    var list = allRequests(), hit = null;
    list.forEach(function (r) {
      if (r.id === id && r.status === 'pending') {      // أول سائق يقبل يفوز
        r.status = 'accepted'; r.acceptedAt = new Date().toISOString();
        r.driver = { name: u.name, phone: u.phone }; hit = r;
      }
    });
    if (!hit) return fail('TAKEN');
    write(K.requests, list);
    return Promise.resolve(hit);
  }
  /* إنهاء الرحلة من الكابتن الذي قبلها */
  function finishTrip(id) {
    var t = myActiveTrip();
    if (!t || t.id !== id) return fail('NOT_FOUND');
    return completeRequest(id, t.driver);
  }

  function cancelRequest(id) {
    var list = allRequests(), hit = null;
    list.forEach(function (r) { if (r.id === id && r.status === 'pending') { r.status = 'cancelled'; r.cancelledAt = new Date().toISOString(); hit = r; } });
    if (!hit) return fail('NOT_FOUND');
    write(K.requests, list);
    return Promise.resolve(hit);
  }

  /* ---------- اشتراكات الكباتن ----------
     الأسعار والمدد وأرقام الحسابات كلها هنا (مكان واحد للتعديل).
     لا يوجد خادم بعد: الكابتن يحوّل المبلغ ويُدخل رقم العملية، فيُسجَّل الطلب "بانتظار التأكيد"،
     ثم تؤكده الإدارة بـ WaseelaStore.approveSubRequest(id). */
  var PLANS = [
    { id: 'trial', name: 'عرض مجاني',  days: 3,  price: 0 },
    { id: 'day',   name: 'يوم',        days: 1,  price: 1000 },
    { id: 'week',  name: 'أسبوع',      days: 7,  price: 5000 },
    { id: 'month', name: 'شهر',        days: 30, price: 15000 }
  ];
  var PAY_METHODS = [
    { id: 'bankak',  name: 'بنكك',     account: '7352205' },
    { id: 'mycashi', name: 'ماي كاشي', account: '400227395' },
    { id: 'fawry',   name: 'فوري',     account: '52037171' }
  ];
  /* ما تحفظه الإدارة (أسعار، مدة العرض المجاني، أرقام الحسابات) يغلب القيم الافتراضية أعلاه */
  function applyConfig() {
    var c = read(K.config, {});
    PLANS.forEach(function (p) {
      if (p.id === 'trial') { if (c.trialDays > 0) p.days = c.trialDays; }
      else if (c.prices && c.prices[p.id] > 0) p.price = c.prices[p.id];
    });
    PAY_METHODS.forEach(function (m) { if (c.accounts && typeof c.accounts[m.id] === 'string' && c.accounts[m.id]) m.account = c.accounts[m.id]; });
  }
  applyConfig();
  function findBy(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  function allSubs() { return read(K.subs, {}); }
  function allSubReqs() { return read(K.subReqs, []); }
  function mySubscription() {
    var u = currentUser(); if (!u) return null;
    var s = allSubs()[u.phone]; if (!s) return null;
    return { planId: s.planId, startedAt: s.startedAt, expiresAt: s.expiresAt, trialUsed: !!s.trialUsed,
             active: !!s.expiresAt && new Date(s.expiresAt).getTime() > Date.now() };
  }
  function hasActiveSubscription() { var s = mySubscription(); return !!s && s.active; }
  function trialUsed() { var s = mySubscription(); return !!s && s.trialUsed; }
  /* يمدّد من تاريخ الانتهاء إن كان الاشتراك ساري، وإلا من الآن */
  function grant(phone, planId) {
    var plan = findBy(PLANS, planId); if (!plan) return null;
    var subs = allSubs(), cur = subs[phone] || {};
    var base = cur.expiresAt && new Date(cur.expiresAt).getTime() > Date.now() ? new Date(cur.expiresAt).getTime() : Date.now();
    var now = new Date().toISOString();
    subs[phone] = { planId: planId, startedAt: (base > Date.now() && cur.startedAt) ? cur.startedAt : now,
                    expiresAt: new Date(base + plan.days * 86400000).toISOString(),
                    trialUsed: !!cur.trialUsed || planId === 'trial' };
    write(K.subs, subs);
    return subs[phone];
  }
  function startTrial() {
    var u = currentUser();
    if (!u) return fail('NO_SESSION');
    if (u.role !== 'driver') return fail('NOT_DRIVER');
    if (trialUsed()) return fail('TRIAL_USED');
    grant(u.phone, 'trial');
    return Promise.resolve(mySubscription());
  }
  function mySubRequests() {
    var u = currentUser(); if (!u) return [];
    return allSubReqs().filter(function (r) { return r.userPhone === u.phone; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }
  function pendingSubRequest() {
    var l = mySubRequests().filter(function (r) { return r.status === 'pending'; });
    return l.length ? l[0] : null;
  }
  /* d = { planId, method, ref } — ref: رقم العملية أو رقم الهاتف المحوَّل منه */
  function requestSubscription(d) {
    var u = currentUser();
    if (!u) return fail('NO_SESSION');
    if (u.role !== 'driver') return fail('NOT_DRIVER');
    var plan = findBy(PLANS, d.planId), method = findBy(PAY_METHODS, d.method);
    if (!plan || plan.price <= 0) return fail('INVALID_PLAN');
    if (!method) return fail('INVALID_METHOD');
    var ref = String(d.ref || '').trim();
    if (ref.length < 4) return fail('INVALID_REF');
    if (pendingSubRequest()) return fail('PENDING_EXISTS');
    var req = { id: 's_' + randomHex(6), userPhone: u.phone, userName: u.name, planId: plan.id, amount: plan.price,
                method: method.id, ref: ref.slice(0, 40), status: 'pending', createdAt: new Date().toISOString() };
    var list = allSubReqs(); list.push(req); write(K.subReqs, list);
    return Promise.resolve(req);
  }
  /* للإدارة: تأكيد استلام الدفع وتفعيل الاشتراك */
  function approveSubRequest(id) {
    if (!isAdmin()) return fail('NOT_ADMIN');
    var list = allSubReqs(), hit = null;
    list.forEach(function (r) {
      if (r.id === id && r.status === 'pending') { r.status = 'approved'; r.approvedAt = new Date().toISOString(); hit = r; }
    });
    if (!hit) return fail('NOT_FOUND');
    write(K.subReqs, list); grant(hit.userPhone, hit.planId);
    return Promise.resolve(hit);
  }
  function rejectSubRequest(id) {
    if (!isAdmin()) return fail('NOT_ADMIN');
    var list = allSubReqs(), hit = null;
    list.forEach(function (r) { if (r.id === id && r.status === 'pending') { r.status = 'rejected'; r.rejectedAt = new Date().toISOString(); hit = r; } });
    if (!hit) return fail('NOT_FOUND');
    write(K.subReqs, list);
    return Promise.resolve(hit);
  }

  /* ---------- الملف الشخصي والإعدادات ---------- */
  function allSettings() { return read(K.settings, {}); }
  function mySettings() {
    var u = currentUser(); if (!u) return {};
    var s = allSettings()[u.phone] || {};
    return { payment: s.payment === 'bankak' ? 'bankak' : 'cash', instantOnly: !!s.instantOnly,
             plate: s.plate || '', vehicle: s.vehicle || '' };
  }
  function saveSettings(patch) {
    var u = currentUser(); if (!u) return fail('NO_SESSION');
    var all = allSettings(), cur = all[u.phone] || {};
    Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
    all[u.phone] = cur; write(K.settings, all);
    return Promise.resolve(mySettings());
  }
  function updateName(name) {
    var u = currentUser(); if (!u) return fail('NO_SESSION');
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 3 || name.length > 40) return fail('INVALID_NAME');
    var users = read(K.users, {}); users[u.phone].name = name; write(K.users, users);
    return Promise.resolve(publicUser(users[u.phone]));
  }
  function changePassword(oldPass, newPass) {
    var u = currentUser(); if (!u) return fail('NO_SESSION');
    if (String(newPass || '').length < 6) return fail('WEAK');
    var users = read(K.users, {}), rec = users[u.phone];
    return (rec.noPass ? Promise.resolve(null) : hashPassword(oldPass, rec.salt, rec.algo)).then(function (h) {
      if (!rec.noPass && h !== rec.hash) throw Object.assign(new Error('WRONG_OLD'), { code: 'WRONG_OLD' });
      var salt = randomHex(16), algo = bestAlgo();
      return hashPassword(newPass, salt, algo).then(function (nh) {
        users = read(K.users, {}); users[u.phone].salt = salt; users[u.phone].hash = nh; users[u.phone].algo = algo; delete users[u.phone].noPass;
        write(K.users, users);
      });
    });
  }
  /* إحصائيات الحساب: للراكب رحلاته، وللكابتن رحلاته المنجزة ومتوسط تقييمه */
  function myStats() {
    var u = currentUser(); if (!u) return null;
    var all = allRequests();
    if (u.role === 'driver') {
      var done = all.filter(function (r) { return r.status === 'completed' && r.driver && r.driver.phone === u.phone; });
      var rated = done.filter(function (r) { return r.rating; });
      var sum = rated.reduce(function (a, r) { return a + r.rating.stars; }, 0);
      return { trips: done.length, ratings: rated.length, avg: rated.length ? sum / rated.length : null };
    }
    var mine = all.filter(function (r) { return r.userPhone === u.phone; });
    return { trips: mine.filter(function (r) { return r.status === 'completed'; }).length,
             cancelled: mine.filter(function (r) { return r.status === 'cancelled'; }).length };
  }
  /* حذف الحساب وكل بياناته من هذا الجهاز (يحتاج كلمة المرور) */
  function deleteAccount(password) {
    var u = currentUser(); if (!u) return fail('NO_SESSION');
    var users = read(K.users, {}), rec = users[u.phone];
    return (rec.noPass ? Promise.resolve(null) : hashPassword(password, rec.salt, rec.algo)).then(function (h) {
      if (!rec.noPass && h !== rec.hash) throw Object.assign(new Error('WRONG_OLD'), { code: 'WRONG_OLD' });
      delete users[u.phone]; write(K.users, users);
      [[K.settings, null], [K.subs, null], [K.favs, null]].forEach(function (p) { var o = read(p[0], {}); delete o[u.phone]; write(p[0], o); });
      write(K.requests, allRequests().filter(function (r) { return r.userPhone !== u.phone; }));
      write(K.subReqs, allSubReqs().filter(function (r) { return r.userPhone !== u.phone; }));
      remove(K.session); remove(K.last);
    });
  }

  /* ---------- أماكني: المشاوير المفضلة (للعميل) ---------- */
  var MAX_FAVS = 20;
  function allFavs() { return read(K.favs, {}); }
  function myFavorites() {
    var u = currentUser(); if (!u) return [];
    return (allFavs()[u.phone] || []).slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }
  function getFavorite(id) { var l = myFavorites().filter(function (f) { return f.id === id; }); return l.length ? l[0] : null; }
  function sameText(a, b) { return String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); }
  function findFavorite(from, to) {
    var l = myFavorites().filter(function (f) { return sameText(f.from, from) && sameText(f.to, to); });
    return l.length ? l[0] : null;
  }
  /* d = { label, from, to } */
  function addFavorite(d) {
    var u = currentUser();
    if (!u) return fail('NO_SESSION');
    if (u.role === 'driver') return fail('NOT_RIDER');
    var label = String(d.label || '').trim(), from = String(d.from || '').trim(), to = String(d.to || '').trim();
    if (label.length < 2) return fail('INVALID_LABEL');
    if (from.length < 2 || to.length < 2 || sameText(from, to)) return fail('INVALID_PLACES');
    if (findFavorite(from, to)) return fail('DUPLICATE');
    var all = allFavs(), list = all[u.phone] || [];
    if (list.length >= MAX_FAVS) return fail('LIMIT');
    var fav = { id: 'f_' + randomHex(6), label: label.slice(0, 30), from: from.slice(0, 80), to: to.slice(0, 80), createdAt: new Date().toISOString() };
    list.push(fav); all[u.phone] = list; write(K.favs, all);
    return Promise.resolve(fav);
  }
  function removeFavorite(id) {
    var u = currentUser(); if (!u) return fail('NO_SESSION');
    var all = allFavs(), list = all[u.phone] || [], n = list.length;
    all[u.phone] = list.filter(function (f) { return f.id !== id; });
    if (all[u.phone].length === n) return fail('NOT_FOUND');
    write(K.favs, all);
    return Promise.resolve();
  }
  /* سجل الرحلات: كل طلبات العميل الأحدث أولاً (myRequests مرتّبة بذلك) */
  function tripHistory() { return myRequests(); }

  /* ---------- جانب الكابتن: رحلاتي ---------- */
  function driverTrips() {
    var u = currentUser(); if (!u || u.role !== 'driver') return [];
    return allRequests().filter(function (r) { return r.driver && r.driver.phone === u.phone && (r.status === 'completed' || r.status === 'accepted'); })
      .sort(function (a, b) { return (b.completedAt || b.acceptedAt || b.createdAt) > (a.completedAt || a.acceptedAt || a.createdAt) ? 1 : -1; });
  }

  /* ---------- الإدارة ----------
     تنبيه: لا يوجد خادم، فحماية لوحة الإدارة هنا على مستوى المتصفح فقط، والبيانات التي تراها هي بيانات هذا الجهاز.
     الحماية الحقيقية تحتاج خادماً وقاعدة بيانات. */
  var ADMIN_TTL = 2 * 3600 * 1000;
  var DEFAULT_ADMIN = 'Admin';
  function adminExists() { return !!read(K.admin, null); }
  function isAdmin() { var s = read(K.adminSession, null); return !!s && Date.now() - new Date(s.at).getTime() < ADMIN_TTL; }
  function needAdmin() { return isAdmin() ? null : fail('NOT_ADMIN'); }
  /* الحساب الافتراضي: اسم المستخدم Admin وكلمة المرور Admin (يُنشأ مرة واحدة إذا لم يوجد حساب) */
  function ensureAdmin() {
    var a = read(K.admin, null);
    if (a) return Promise.resolve(a);
    var salt = randomHex(16), algo = bestAlgo();
    return hashPassword(DEFAULT_ADMIN, salt, algo).then(function (hash) {
      var rec = { username: DEFAULT_ADMIN, salt: salt, hash: hash, algo: algo, isDefault: true, createdAt: new Date().toISOString() };
      write(K.admin, rec);
      return rec;
    });
  }
  function adminUsername() { var a = read(K.admin, null); return (a && a.username) || DEFAULT_ADMIN; }
  function adminIsDefault() { var a = read(K.admin, null); return !a || !!a.isDefault; }
  function sameUser(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }
  function adminLogin(username, password) {
    return ensureAdmin().then(function (a) {
      return hashPassword(String(password || ''), a.salt, a.algo).then(function (h) {
        if (h !== a.hash || !sameUser(username, a.username || DEFAULT_ADMIN)) throw Object.assign(new Error('INVALID'), { code: 'INVALID' });
        write(K.adminSession, { at: new Date().toISOString() });
      });
    });
  }
  function adminLogout() { remove(K.adminSession); }
  /* تغيير اسم المستخدم و/أو كلمة المرور (تُترك كلمة المرور الجديدة فارغة للإبقاء على الحالية) */
  function adminUpdateCredentials(oldPass, newUser, newPass) {
    var g = needAdmin(); if (g) return g;
    newUser = String(newUser || '').trim(); newPass = String(newPass || '');
    if (newUser.length < 3 || newUser.length > 30 || /\s/.test(newUser)) return fail('BAD_USER');
    if (newPass && newPass.length < 8) return fail('WEAK');
    var a = read(K.admin, null); if (!a) return fail('NO_ADMIN');
    return hashPassword(String(oldPass || ''), a.salt, a.algo).then(function (h) {
      if (h !== a.hash) throw Object.assign(new Error('INVALID'), { code: 'INVALID' });
      a.username = newUser;
      if (!newPass) { write(K.admin, a); return; }
      var salt = randomHex(16), algo = bestAlgo();
      return hashPassword(newPass, salt, algo).then(function (nh) { a.salt = salt; a.hash = nh; a.algo = algo; a.isDefault = false; write(K.admin, a); });
    });
  }
  function subInfo(phone) {
    var s = allSubs()[phone]; if (!s) return null;
    return { planId: s.planId, expiresAt: s.expiresAt, active: !!s.expiresAt && new Date(s.expiresAt).getTime() > Date.now() };
  }
  function adminUsers() {
    if (!isAdmin()) return [];
    var reqs = allRequests(), users = read(K.users, {});
    return Object.keys(users).map(function (ph) {
      var u = users[ph], mine = u.role === 'driver'
        ? reqs.filter(function (r) { return r.status === 'completed' && r.driver && r.driver.phone === ph; })
        : reqs.filter(function (r) { return r.userPhone === ph; });
      return { name: u.name, phone: ph, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
               trips: mine.length, sub: u.role === 'driver' ? subInfo(ph) : null };
    }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }
  function adminRequests() {
    if (!isAdmin()) return [];
    return allRequests().slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }
  function adminSubRequests() {
    if (!isAdmin()) return [];
    return allSubReqs().slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }
  function adminStats() {
    if (!isAdmin()) return null;
    var users = adminUsers(), reqs = allRequests(), subs = allSubReqs(), by = function (st) { return reqs.filter(function (r) { return r.status === st; }).length; };
    var rated = reqs.filter(function (r) { return r.rating; }), sum = rated.reduce(function (a, r) { return a + r.rating.stars; }, 0);
    var today = new Date().toDateString();
    return {
      riders: users.filter(function (u) { return u.role === 'rider'; }).length,
      drivers: users.filter(function (u) { return u.role === 'driver'; }).length,
      activeSubs: users.filter(function (u) { return u.sub && u.sub.active; }).length,
      pendingPayments: subs.filter(function (r) { return r.status === 'pending'; }).length,
      revenue: subs.filter(function (r) { return r.status === 'approved'; }).reduce(function (a, r) { return a + r.amount; }, 0),
      requests: reqs.length, pending: by('pending'), accepted: by('accepted'), completed: by('completed'), cancelled: by('cancelled'),
      today: reqs.filter(function (r) { return new Date(r.createdAt).toDateString() === today; }).length,
      avgRating: rated.length ? sum / rated.length : null, ratings: rated.length
    };
  }
  function adminGrant(phone, planId) {
    var g = needAdmin(); if (g) return g;
    if (!read(K.users, {})[phone] || read(K.users, {})[phone].role !== 'driver') return fail('NOT_FOUND');
    if (!grant(phone, planId)) return fail('INVALID_PLAN');
    return Promise.resolve(subInfo(phone));
  }
  function adminRevoke(phone) {
    var g = needAdmin(); if (g) return g;
    var subs = allSubs(); if (!subs[phone]) return fail('NOT_FOUND');
    subs[phone].expiresAt = new Date().toISOString(); write(K.subs, subs);
    return Promise.resolve();
  }
  function adminCancelRequest(id) {
    var g = needAdmin(); if (g) return g;
    var list = allRequests(), hit = null;
    list.forEach(function (r) { if (r.id === id && (r.status === 'pending' || r.status === 'accepted')) { r.status = 'cancelled'; r.cancelledAt = new Date().toISOString(); r.cancelledBy = 'admin'; hit = r; } });
    if (!hit) return fail('NOT_FOUND');
    write(K.requests, list); return Promise.resolve(hit);
  }
  function adminDeleteUser(phone) {
    var g = needAdmin(); if (g) return g;
    var users = read(K.users, {}); if (!users[phone]) return fail('NOT_FOUND');
    delete users[phone]; write(K.users, users);
    [K.settings, K.subs, K.favs].forEach(function (key) { var o = read(key, {}); delete o[phone]; write(key, o); });
    write(K.requests, allRequests().filter(function (r) { return r.userPhone !== phone && !(r.driver && r.driver.phone === phone && r.status === 'accepted'); }));
    write(K.subReqs, allSubReqs().filter(function (r) { return r.userPhone !== phone; }));
    var s = read(K.session, null); if (s && s.phone === phone) remove(K.session);
    return Promise.resolve();
  }
  function adminConfig() {
    return { plans: PLANS.map(function (p) { return { id: p.id, name: p.name, days: p.days, price: p.price }; }),
             methods: PAY_METHODS.map(function (m) { return { id: m.id, name: m.name, account: m.account }; }) };
  }
  /* d = { prices:{day,week,month}, trialDays, accounts:{bankak,mycashi,fawry} } */
  function adminSaveConfig(d) {
    var g = needAdmin(); if (g) return g;
    var out = { prices: {}, accounts: {} };
    ['day', 'week', 'month'].forEach(function (id) { out.prices[id] = Math.round(Number(d.prices && d.prices[id])); });
    for (var k in out.prices) if (!(out.prices[k] > 0 && out.prices[k] <= 10000000)) return fail('INVALID_PRICE');
    out.trialDays = Math.round(Number(d.trialDays));
    if (!(out.trialDays >= 1 && out.trialDays <= 30)) return fail('INVALID_TRIAL');
    PAY_METHODS.forEach(function (m) { out.accounts[m.id] = String((d.accounts && d.accounts[m.id]) || '').trim().slice(0, 30); });
    write(K.config, out); applyConfig();
    return Promise.resolve(adminConfig());
  }

  /* العميل يشارك موقعه الحالي (أو يحدّثه) على طلبه الجاري ليصل إليه الكابتن. coords = { lat, lng, accuracy } */
  function updateRequestLocation(id, coords) {
    var u = currentUser(); if (!u) return fail('NO_SESSION');
    var lat = Number(coords && coords.lat), lng = Number(coords && coords.lng);
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return fail('INVALID_COORDS');
    var list = allRequests(), hit = null;
    list.forEach(function (r) {
      if (r.id === id && r.userPhone === u.phone && (r.status === 'pending' || r.status === 'accepted')) {
        r.fromCoords = { lat: +lat.toFixed(5), lng: +lng.toFixed(5), accuracy: Math.round(Number(coords.accuracy) || 0) };
        r.locationAt = new Date().toISOString(); hit = r;
      }
    });
    if (!hit) return fail('NOT_FOUND');
    write(K.requests, list);
    return Promise.resolve(hit);
  }

  global.WaseelaStore = {
    normalizePhone: normalizePhone, isValidPhone: isValidPhone,
    register: register, login: login, phoneStatus: phoneStatus, hasPassword: hasPassword, currentUser: currentUser, logout: logout,
    createRequest: createRequest, myRequests: myRequests, activeRequest: activeRequest, cancelRequest: cancelRequest,
    completeRequest: completeRequest, openRequests: openRequests, myActiveTrip: myActiveTrip, acceptRequest: acceptRequest, finishTrip: finishTrip, getRequest: getRequest, ratableTrips: ratableTrips, rateTrip: rateTrip,
    PLANS: PLANS, PAY_METHODS: PAY_METHODS, mySubscription: mySubscription, hasActiveSubscription: hasActiveSubscription, trialUsed: trialUsed,
    startTrial: startTrial, requestSubscription: requestSubscription, mySubRequests: mySubRequests, pendingSubRequest: pendingSubRequest,
    approveSubRequest: approveSubRequest, rejectSubRequest: rejectSubRequest,
    mySettings: mySettings, saveSettings: saveSettings, updateName: updateName, changePassword: changePassword, myStats: myStats, deleteAccount: deleteAccount,
    myFavorites: myFavorites, getFavorite: getFavorite, findFavorite: findFavorite, addFavorite: addFavorite, removeFavorite: removeFavorite, tripHistory: tripHistory, MAX_FAVS: MAX_FAVS,
    driverTrips: driverTrips,
    adminExists: adminExists, isAdmin: isAdmin, adminLogin: adminLogin, adminLogout: adminLogout, adminUpdateCredentials: adminUpdateCredentials, adminUsername: adminUsername, adminIsDefault: adminIsDefault,
    adminUsers: adminUsers, adminRequests: adminRequests, adminSubRequests: adminSubRequests, adminStats: adminStats, adminGrant: adminGrant, adminRevoke: adminRevoke,
    adminCancelRequest: adminCancelRequest, adminDeleteUser: adminDeleteUser, adminConfig: adminConfig, adminSaveConfig: adminSaveConfig,
    updateRequestLocation: updateRequestLocation,
    getLastPhone: function () { return read(K.last, ''); },
    isPersistent: function () { return persistent; },
    clearAll: function () { remove(K.users); remove(K.session); remove(K.last); remove(K.requests); remove(K.subs); remove(K.subReqs); remove(K.settings); remove(K.favs); remove(K.config); }
  };
})(window);

/* شريط التنقل السفلي. يُحمَّل بعد store.js في الصفحات الرئيسية فقط (لا يظهر في الدخول/التسجيل/البداية).
   العميل: الرئيسية، طلباتي، أماكني، السجل، حسابي.
   الكابتن: صفحتا «أماكني» و«السجل» للعملاء فقط، فيحلّ محلهما «الطلبات المتاحة» و«الاشتراك». */
(function () {
  var S = window.WaseelaStore, user = S && S.currentUser();
  if (!user) return;

  var P = {   // أيقونات خطية بسيطة (24×24)
    home:   '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    orders: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>',
    places: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    history:'<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4h4"/><path d="M12 8v4.2l2.8 1.8"/>',
    me:     '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-3.9 3.7-6 7.5-6s6.7 2.1 7.5 6"/>',
    sub:    '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M7 15h4"/>'
  };
  var items = user.role === 'driver' ? [
    ['home.html', 'الرئيسية', P.home], ['orders.html', 'الطلبات', P.orders],
    ['subscription.html', 'الاشتراك', P.sub], ['profile.html', 'حسابي', P.me]
  ] : [
    ['home.html', 'الرئيسية', P.home], ['request.html', 'طلباتي', P.orders],
    ['places.html', 'أماكني', P.places], ['history.html', 'السجل', P.history], ['profile.html', 'حسابي', P.me]
  ];

  var page = (location.pathname.split('/').pop() || 'home.html');
  var nav = document.createElement('nav');
  nav.className = 'bnav'; nav.setAttribute('aria-label', 'التنقل الرئيسي');
  var ul = document.createElement('ul');
  items.forEach(function (it) {
    var li = document.createElement('li'), a = document.createElement('a');
    a.href = it[0];
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + it[2] + '</svg><span></span>';
    a.lastChild.textContent = it[1];
    if (it[0] === page) a.setAttribute('aria-current', 'page');
    li.appendChild(a); ul.appendChild(li);
  });
  nav.appendChild(ul);
  document.body.appendChild(nav);
  document.body.classList.add('has-bnav');
})();

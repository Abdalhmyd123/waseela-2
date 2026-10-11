var svg = document.getElementById('logo'), timer;
// إذا كان هناك حساب مسجَّل دخوله ننتقل للرئيسية، وإلا لصفحة الدخول
function target() { return WaseelaStore.currentUser() ? 'home.html' : 'login.html'; }
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(function () {
    window.dispatchEvent(new Event('waseela:splash-done'));
    document.body.classList.add('leave');
    setTimeout(function () { location.href = target(); }, 450);
  }, 3500);                                  // 3 ثوانٍ أنميشن + نصف ثانية ثبات
}
function replay() {
  var c = svg.cloneNode(true); svg.replaceWith(c); svg = c;
  document.body.classList.remove('leave');
  schedule();
}
document.getElementById('replay').onclick = replay;
schedule();

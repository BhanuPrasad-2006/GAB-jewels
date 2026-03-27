/**
 * GAB Jewels — auth.js
 * Smart login/signup:
 *  - Login with no account → auto switches to signup tab
 *  - Signup with existing email → auto switches to login tab
 *  - OTP sent to the user's entered mobile number
 */

const CONFIG = {
    ADMIN_EMAIL:  'admin@gabjewels.com',
    ADMIN_PASS:   'Admin@1234',
    ADMIN_URL:    '/pages/admin/dashboard.html',
    CUSTOMER_URL: '/index.html',
    OTP_COOLDOWN: 30,
  };
  
  const PW_RULES = {
    len: { test: pw => pw.length >= 8,           id: 'pr-len' },
    up:  { test: pw => /[A-Z]/.test(pw),         id: 'pr-up'  },
    low: { test: pw => /[a-z]/.test(pw),         id: 'pr-low' },
    num: { test: pw => /[0-9]/.test(pw),         id: 'pr-num' },
    sym: { test: pw => /[^A-Za-z0-9]/.test(pw), id: 'pr-sym' },
  };
  
  let serverOnline = false;
  let sd           = {};
  let resendTimer  = null;
  let localOTP     = null;
  
  (async function init() {
    if (localStorage.getItem('isLoggedIn') === 'true') {
      const role = localStorage.getItem('aurum_role');
      location.href = role === 'admin' ? CONFIG.ADMIN_URL : CONFIG.CUSTOMER_URL;
      return;
    }
    try {
      const r = await fetch('/api/products', { signal: AbortSignal.timeout(2000) });
      serverOnline = r.ok;
    } catch { serverOnline = false; }
    if (!serverOnline) document.getElementById('offbanner').style.display = 'block';
    setupOTPBoxes();
    setupEnterKey();
  })();
  
  window.GAB = {
  
    switchTab(t) {
      clearMsg();
      document.getElementById('tl').classList.toggle('on', t === 'login');
      document.getElementById('ts').classList.toggle('on', t === 'signup');
      show(t === 'login' ? 'vl' : 'vs1');
    },
  
    eye(id) {
      const inp = document.getElementById(id);
      inp.type = inp.type === 'password' ? 'text' : 'password';
    },
  
    strength(pw) {
      const score  = Object.values(PW_RULES).filter(r => r.test(pw)).length;
      const colors = ['', '#E07070', '#E8C97A', '#C9A84C', '#C9A84C', '#6DBF8A'];
      const labels = ['Enter a password', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
      for (let i = 1; i <= 4; i++)
        document.getElementById('ss' + i).style.background = i <= score ? colors[score] : 'rgba(201,168,76,.1)';
      document.getElementById('slbl').textContent = pw.length ? labels[score] : labels[0];
      Object.values(PW_RULES).forEach(rule => {
        const el = document.getElementById(rule.id);
        if (el) el.classList.toggle('ok', rule.test(pw));
      });
    },
  
    // ── LOGIN ──────────────────────────────────────────────────
    async doLogin() {
      clearMsg();
      const email = document.getElementById('le').value.trim().toLowerCase();
      const pass  = document.getElementById('lp').value;
      if (!email || !pass)      { showMsg('Please enter your email and password.'); return; }
      if (!isValidEmail(email)) { showMsg('Please enter a valid email address.'); return; }
  
      const btn = document.getElementById('lbtn');
      setLoading(btn, true, 'Signing in...');
  
      // ── OFFLINE ──
      if (!serverOnline) {
        await _offlineLogin(email, pass, btn);
        return;
      }
  
      // ── ONLINE ──
      try {
        const r = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pass }),
        });
        const d = await r.json();
  
        if (r.status === 404 && d.redirect === 'signup') {
          // No account — switch to signup and pre-fill email
          setLoading(btn, false, 'Enter the Vault');
          showMsg('No account found. Please create one first.', 'info');
          setTimeout(() => {
            GAB.switchTab('signup');
            const emailField = document.getElementById('se');
            if (emailField) emailField.value = email;
            clearMsg();
          }, 1500);
          return;
        }
  
        if (!r.ok) {
          showMsg(d.error || 'Incorrect email or password.');
          setLoading(btn, false, 'Enter the Vault');
          return;
        }
  
        saveSession(d.role, d.token, d.name, d.email);
        location.href = d.role === 'admin' ? CONFIG.ADMIN_URL : CONFIG.CUSTOMER_URL;
  
      } catch {
        showMsg('Cannot connect to server. Please try again.');
        setLoading(btn, false, 'Enter the Vault');
      }
    },
  
    // ── SIGNUP STEP 1 ──────────────────────────────────────────
    async goStep2() {
      clearMsg();
      const name  = document.getElementById('sn').value.trim();
      const email = document.getElementById('se').value.trim().toLowerCase();
      const phone = document.getElementById('sp').value.trim();
      const code  = document.getElementById('sc').value;
  
      if (!name)                             { showMsg('Please enter your full name.'); return; }
      if (!email || !isValidEmail(email))    { showMsg('Please enter a valid email address.'); return; }
      if (!phone || !/^\d{10}$/.test(phone)) { showMsg('Please enter a valid 10-digit mobile number.'); return; }
  
      sd = { name, email, phone, code, fullPhone: code + phone };
      document.getElementById('otpdisp').textContent = code + ' ' + phone;
  
      const btn = document.getElementById('s1btn');
      setLoading(btn, true, 'Sending OTP...');
  
      // ── OFFLINE ──
      if (!serverOnline) {
        localOTP = String(Math.floor(100000 + Math.random() * 900000));
        setLoading(btn, false, 'Continue & Send OTP');
        showMsg('Offline mode — your OTP is: ' + localOTP, 'info');
        show('vs2'); startResendTimer();
        setTimeout(() => document.getElementById('ob0').focus(), 300);
        return;
      }
  
      // ── ONLINE ──
      try {
        const r = await fetch('/api/auth/send-otp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: sd.fullPhone, email: sd.email }),
        });
        const d = await r.json();
        setLoading(btn, false, 'Continue & Send OTP');
  
        if (r.status === 409 && d.redirect === 'login') {
          // Email already registered — switch to login tab
          showMsg('This email is already registered. Switching to sign in...', 'info');
          setTimeout(() => {
            GAB.switchTab('login');
            const emailField = document.getElementById('le');
            if (emailField) emailField.value = sd.email;
            clearMsg();
            showMsg('Account found! Please enter your password.', 'ok');
          }, 1500);
          return;
        }
  
        if (!r.ok) { showMsg(d.error || 'Could not send OTP. Please try again.'); return; }
  
        if (d.dev_otp) {
          showMsg('SMS not active. Your OTP is: ' + d.dev_otp, 'info');
        } else {
          showMsg('OTP sent to ' + code + ' ' + phone, 'ok');
        }
  
        show('vs2'); startResendTimer();
        setTimeout(() => document.getElementById('ob0').focus(), 300);
  
      } catch {
        setLoading(btn, false, 'Continue & Send OTP');
        showMsg('Cannot connect to server. Please try again.');
      }
    },
  
    // ── VERIFY OTP ─────────────────────────────────────────────
    async verifyOTP() {
      clearMsg();
      const entered = [0,1,2,3,4,5].map(i => document.getElementById('ob' + i).value).join('');
      if (entered.length < 6) { showMsg('Please enter the complete 6-digit OTP.'); return; }
  
      const btn = document.getElementById('s2btn');
      setLoading(btn, true, 'Verifying...');
  
      if (!serverOnline) {
        if (entered === localOTP) goStep3();
        else { showMsg('Incorrect OTP. Please try again.'); setLoading(btn, false, 'Verify OTP'); }
        return;
      }
  
      try {
        const r = await fetch('/api/auth/verify-otp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: sd.fullPhone, otp: entered }),
        });
        const d = await r.json();
        if (r.ok) goStep3();
        else { showMsg(d.error || 'Incorrect OTP. Please try again.'); setLoading(btn, false, 'Verify OTP'); }
      } catch {
        showMsg('Cannot connect to server.');
        setLoading(btn, false, 'Verify OTP');
      }
    },
  
    // ── RESEND OTP ─────────────────────────────────────────────
    async resend() {
      if (!serverOnline) {
        localOTP = String(Math.floor(100000 + Math.random() * 900000));
        showMsg('New OTP: ' + localOTP, 'info');
        startResendTimer(); return;
      }
      try {
        const r = await fetch('/api/auth/send-otp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: sd.fullPhone, email: sd.email }),
        });
        const d = await r.json();
        if (d.dev_otp) showMsg('New OTP: ' + d.dev_otp, 'info');
        else showMsg('New OTP sent to your mobile!', 'ok');
      } catch { showMsg('Could not resend OTP. Try again.'); }
      startResendTimer();
    },
  
    // ── FINISH ─────────────────────────────────────────────────
    async finish() {
      clearMsg();
      const pw  = document.getElementById('spw').value;
      const pw2 = document.getElementById('spw2').value;
      if (Object.values(PW_RULES).some(r => !r.test(pw))) {
        showMsg('Password must have uppercase, lowercase, number & symbol (min 8 chars).'); return;
      }
      if (pw !== pw2) { showMsg('Passwords do not match.'); return; }
  
      const btn = document.getElementById('s3btn');
      setLoading(btn, true, 'Creating account...');
  
      if (!serverOnline) { _offlineRegister(pw, btn); return; }
  
      try {
        const r = await fetch('/api/auth/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sd.name, email: sd.email, phone: sd.fullPhone, password: pw }),
        });
        const d = await r.json();
  
        if (r.status === 409 && d.redirect === 'login') {
          setLoading(btn, false, 'Enter the Store');
          showMsg('Account already exists. Switching to sign in...', 'info');
          setTimeout(() => {
            GAB.switchTab('login');
            const emailField = document.getElementById('le');
            if (emailField) emailField.value = sd.email;
            clearMsg();
            showMsg('Account found! Please enter your password.', 'ok');
          }, 1500);
          return;
        }
  
        if (!r.ok) { showMsg(d.error || 'Registration failed. Please try again.'); setLoading(btn, false, 'Enter the Store'); return; }
  
        // Auto-login after register
        try {
          const lr = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: sd.email, password: pw }),
          });
          const ld = await lr.json();
          if (lr.ok) saveSession(ld.role, ld.token, ld.name, ld.email);
        } catch {}
  
        document.getElementById('smsg').textContent = 'Welcome, ' + sd.name + '. Your account is ready.';
        show('vok');
      } catch {
        showMsg('Cannot connect to server. Please try again.');
      } finally {
        setLoading(btn, false, 'Enter the Store');
      }
    },
  
    go() { location.href = CONFIG.CUSTOMER_URL; },
  };
  
  // ── OFFLINE HELPERS ────────────────────────────────────────────
  async function _offlineLogin(email, pass, btn) {
    if (email === CONFIG.ADMIN_EMAIL && pass === CONFIG.ADMIN_PASS) {
      saveSession('admin', 'demo-admin-token', 'Admin', email);
      location.href = CONFIG.ADMIN_URL; return;
    }
    const accs  = JSON.parse(localStorage.getItem('gab_accs') || '[]');
    const found = accs.find(a => a.email === email && a.pass === pass);
    if (found) {
      saveSession('customer', 'local-token', found.name, email);
      location.href = CONFIG.CUSTOMER_URL;
    } else {
      const anyAccount = accs.find(a => a.email === email);
      if (!anyAccount) {
        showMsg('No account found. Please create an account first.', 'info');
        setTimeout(() => { GAB.switchTab('signup'); const ef = document.getElementById('se'); if (ef) ef.value = email; clearMsg(); }, 1500);
      } else {
        showMsg('Incorrect password. Please try again.');
      }
      setLoading(btn, false, 'Enter the Vault');
    }
  }
  
  function _offlineRegister(pw, btn) {
    const accs = JSON.parse(localStorage.getItem('gab_accs') || '[]');
    if (accs.find(a => a.email === sd.email)) {
      showMsg('Account already exists. Switching to sign in...', 'info');
      setTimeout(() => { GAB.switchTab('login'); const ef = document.getElementById('le'); if (ef) ef.value = sd.email; clearMsg(); showMsg('Please enter your password.', 'ok'); }, 1500);
      setLoading(btn, false, 'Enter the Store'); return;
    }
    accs.push({ name: sd.name, email: sd.email, phone: sd.fullPhone, pass: pw });
    localStorage.setItem('gab_accs', JSON.stringify(accs));
    saveSession('customer', 'local-token', sd.name, sd.email);
    document.getElementById('smsg').textContent = 'Welcome, ' + sd.name + '. Your account is ready.';
    show('vok');
    setLoading(btn, false, 'Enter the Store');
  }
  
  // ── SESSION ────────────────────────────────────────────────────
  function saveSession(role, token, name, email) {
    localStorage.setItem('aurum_token', token);
    localStorage.setItem('aurum_role',  role);
    localStorage.setItem('isLoggedIn',  'true');
    if (name)  localStorage.setItem('aurum_name',  name);
    if (email) localStorage.setItem('aurum_email', email);
  }
  
  // ── UI HELPERS ─────────────────────────────────────────────────
  function show(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
    document.getElementById(id).classList.add('on');
    clearMsg();
  }
  function goStep3() { show('vs3'); document.getElementById('spw').focus(); }
  function showMsg(text, type = 'err') {
    const m = document.getElementById('msg');
    m.textContent = text;
    m.className   = 'msg ' + type + ' on';
  }
  function clearMsg() { document.getElementById('msg').className = 'msg'; }
  function setLoading(btn, loading, label) {
    btn.disabled  = loading;
    btn.innerHTML = loading ? '<span class="spinner"></span>' + label : label;
  }
  function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
  
  // ── OTP BOXES ──────────────────────────────────────────────────
  function setupOTPBoxes() {
    for (let i = 0; i < 6; i++) {
      const box = document.getElementById('ob' + i);
      if (!box) continue;
      box.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
        this.classList.toggle('fl', this.value !== '');
        if (this.value && i < 5) document.getElementById('ob' + (i+1)).focus();
      });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !this.value && i > 0) document.getElementById('ob' + (i-1)).focus();
      });
      box.addEventListener('paste', function (e) {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
        pasted.split('').slice(0, 6).forEach((ch, idx) => {
          const b = document.getElementById('ob' + idx);
          if (b) { b.value = ch; b.classList.add('fl'); }
        });
        if ([0,1,2,3,4,5].every(i => document.getElementById('ob'+i).value)) GAB.verifyOTP();
        e.preventDefault();
      });
    }
  }
  
  // ── RESEND TIMER ───────────────────────────────────────────────
  function startResendTimer() {
    let secs = CONFIG.OTP_COOLDOWN;
    const btn = document.getElementById('rbtn');
    btn.disabled  = true;
    btn.innerHTML = 'Resend in <span class="rtmr" id="rtmr">' + secs + 's</span>';
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      secs--;
      const t = document.getElementById('rtmr');
      if (t) t.textContent = secs + 's';
      if (secs <= 0) { clearInterval(resendTimer); btn.disabled = false; btn.innerHTML = 'Resend OTP'; }
    }, 1000);
  }
  
  // ── ENTER KEY ──────────────────────────────────────────────────
  function setupEnterKey() {
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const active = document.querySelector('.view.on');
      if (!active) return;
      if (active.id === 'vl')  GAB.doLogin();
      if (active.id === 'vs1') GAB.goStep2();
      if (active.id === 'vs2') GAB.verifyOTP();
      if (active.id === 'vs3') GAB.finish();
    });
  }
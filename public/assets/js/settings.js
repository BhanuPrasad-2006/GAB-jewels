/* ============================================================
   SETTINGS.JS — GAB Jewels
   - localStorage-first (works without server)
   - Falls back gracefully if server is offline
   - OTP via server.js Twilio integration
   - Fixed logout key to match index.html
   ============================================================ */

const API = 'http://localhost:3000'; // Change if server is on a different port
const SETTINGS_KEY = 'gab_settings';

document.addEventListener('DOMContentLoaded', () => {

    // ── 1. Tab switching ──
    const tabs     = document.querySelectorAll('.settings-nav li:not(.settings-logout)');
    const sections = document.querySelectorAll('.settings-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // ── 2. Toast helper ──
    function toast(message, type = 'success') {
        const el = document.getElementById('settings-toast');
        el.textContent = (type === 'success' ? '✦ ' : '✕ ') + message;
        el.className = 'settings-toast show' + (type === 'error' ? ' error' : '');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => { el.classList.remove('show'); }, 3500);
    }

    // ── 3. Load settings (server → localStorage fallback) ──
    async function loadSettings() {
        let data = null;

        try {
            const res = await fetch(`${API}/api/settings`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) data = await res.json();
        } catch {
            // Server offline — use localStorage
        }

        if (!data) {
            const stored = localStorage.getItem(SETTINGS_KEY);
            data = stored ? JSON.parse(stored) : getDefaultSettings();
        }

        applySettings(data);
    }

    function getDefaultSettings() {
        return {
            name: 'Yatish',
            email: 'yatish@example.com',
            phone: '',
            address: '',
            city: '',
            pin: '',
            twoFactor: false,
            currency: 'INR',
            priceAlerts: true,
            orderNotif: true,
            promoNotif: false
        };
    }

    function applySettings(data) {
        // Profile
        setValue('user-name',    data.name);
        setValue('user-email',   data.email);
        setValue('user-phone',   data.phone);
        setValue('user-address', data.address);
        setValue('user-city',    data.city);
        setValue('user-pin',     data.pin);

        // Security
        setChecked('2fa-toggle', data.twoFactor);

        // Preferences
        setValue('currency',       data.currency);
        setChecked('price-alert',  data.priceAlerts);
        setChecked('order-notif',  data.orderNotif);
        setChecked('promo-notif',  data.promoNotif);

        // Sidebar
        const name = data.name || 'User';
        document.getElementById('sidebar-name').textContent  = name;
        document.getElementById('sidebar-email').textContent = data.email || '';
        document.getElementById('settings-avatar').textContent = name.charAt(0).toUpperCase();
    }

    function setValue(id, val) {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
    }

    function setChecked(id, val) {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    }

    function getCurrentSettings() {
        return {
            name:        document.getElementById('user-name')?.value    || '',
            email:       document.getElementById('user-email')?.value   || '',
            phone:       document.getElementById('user-phone')?.value   || '',
            address:     document.getElementById('user-address')?.value || '',
            city:        document.getElementById('user-city')?.value    || '',
            pin:         document.getElementById('user-pin')?.value     || '',
            twoFactor:   document.getElementById('2fa-toggle')?.checked || false,
            currency:    document.getElementById('currency')?.value     || 'INR',
            priceAlerts: document.getElementById('price-alert')?.checked || false,
            orderNotif:  document.getElementById('order-notif')?.checked || false,
            promoNotif:  document.getElementById('promo-notif')?.checked || false
        };
    }

    async function saveToServer(endpoint, payload) {
        try {
            const res = await fetch(`${API}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(3000)
            });
            return res.ok;
        } catch {
            return false; // server offline
        }
    }

    // ── 4. Save Profile ──
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = getCurrentSettings();

        // Save to localStorage always
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...stored, ...data }));

        // Try server too
        await saveToServer('/api/settings/profile', {
            name: data.name, email: data.email,
            phone: data.phone, address: data.address,
            city: data.city, pin: data.pin
        });

        // Update sidebar live
        document.getElementById('sidebar-name').textContent  = data.name || 'User';
        document.getElementById('sidebar-email').textContent = data.email || '';
        document.getElementById('settings-avatar').textContent = (data.name || 'U').charAt(0).toUpperCase();

        toast('Profile saved successfully');
    });

    // ── 5. OTP — Send ──
    const btnSendOtp   = document.getElementById('btn-send-otp');
    const btnVerifyOtp = document.getElementById('btn-verify-otp');
    const otpRow       = document.getElementById('otp-row');
    const otpStatus    = document.getElementById('otp-status');
    let otpCooldown    = null;

    btnSendOtp.addEventListener('click', async () => {
        const phone = document.getElementById('user-phone').value.trim();
        if (!phone || phone.replace(/\D/g,'').length < 10) {
            toast('Please enter a valid 10-digit phone number', 'error'); return;
        }

        btnSendOtp.disabled = true;
        btnSendOtp.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const res = await fetch(`${API}/api/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone }),
                signal: AbortSignal.timeout(8000)
            });
            const result = await res.json();

            if (result.success) {
                otpRow.style.display = 'block';
                otpStatus.textContent = '';
                toast('OTP sent to your number');

                // Cooldown 60s
                let secs = 60;
                btnSendOtp.innerHTML = `Resend (${secs}s)`;
                otpCooldown = setInterval(() => {
                    secs--;
                    btnSendOtp.innerHTML = `Resend (${secs}s)`;
                    if (secs <= 0) {
                        clearInterval(otpCooldown);
                        btnSendOtp.disabled = false;
                        btnSendOtp.innerHTML = 'Resend <i class="fas fa-mobile-alt"></i>';
                    }
                }, 1000);
            } else {
                toast(result.message || 'Failed to send OTP. Check server.', 'error');
                btnSendOtp.disabled = false;
                btnSendOtp.innerHTML = 'Verify <i class="fas fa-mobile-alt"></i>';
            }
        } catch {
            toast('Server offline. OTP unavailable.', 'error');
            btnSendOtp.disabled = false;
            btnSendOtp.innerHTML = 'Verify <i class="fas fa-mobile-alt"></i>';
        }
    });

    // ── 6. OTP — Verify ──
    btnVerifyOtp.addEventListener('click', async () => {
        const phone = document.getElementById('user-phone').value.trim();
        const code  = document.getElementById('otp-input').value.trim();

        if (!code || code.length < 4) {
            otpStatus.textContent = 'Please enter the OTP.';
            otpStatus.className   = 'otp-status error';
            return;
        }

        btnVerifyOtp.disabled = true;
        btnVerifyOtp.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const res = await fetch(`${API}/api/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone, code }),
                signal: AbortSignal.timeout(8000)
            });
            const result = await res.json();

            if (result.success) {
                otpStatus.textContent = '✓ Phone number verified successfully';
                otpStatus.className   = 'otp-status success';
                btnVerifyOtp.innerHTML = '<i class="fas fa-check"></i>';
                toast('Phone number verified!');
                clearInterval(otpCooldown);
            } else {
                otpStatus.textContent = '✕ Invalid OTP. Please try again.';
                otpStatus.className   = 'otp-status error';
                btnVerifyOtp.disabled = false;
                btnVerifyOtp.innerHTML = 'Confirm <i class="fas fa-check"></i>';
            }
        } catch {
            otpStatus.textContent = 'Could not reach server.';
            otpStatus.className   = 'otp-status error';
            btnVerifyOtp.disabled = false;
            btnVerifyOtp.innerHTML = 'Confirm <i class="fas fa-check"></i>';
        }
    });

    // ── 7. 2FA toggle ──
    document.getElementById('2fa-toggle').addEventListener('change', async (e) => {
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        stored.twoFactor = e.target.checked;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));
        await saveToServer('/api/settings/security', { twoFactor: e.target.checked });
        toast('2FA ' + (e.target.checked ? 'enabled' : 'disabled'));
    });

    // ── 8. Change password UI toggle ──
    document.getElementById('btn-change-password').addEventListener('click', () => {
        const wrap = document.getElementById('password-form-wrap');
        const isHidden = wrap.style.display === 'none';
        wrap.style.display = isHidden ? 'flex' : 'none';
    });

    document.getElementById('btn-save-password').addEventListener('click', async () => {
        const current  = document.getElementById('current-password').value;
        const newPass  = document.getElementById('new-password').value;
        const confirm  = document.getElementById('confirm-password').value;

        if (!current || !newPass) { toast('Please fill in all password fields', 'error'); return; }
        if (newPass !== confirm)  { toast('New passwords do not match', 'error'); return; }
        if (newPass.length < 6)   { toast('Password must be at least 6 characters', 'error'); return; }

        const ok = await saveToServer('/api/settings/password', { currentPassword: current, newPassword: newPass });
        if (ok) {
            toast('Password updated successfully');
            document.getElementById('password-form-wrap').style.display = 'none';
            ['current-password','new-password','confirm-password'].forEach(id => {
                document.getElementById(id).value = '';
            });
        } else {
            toast('Password update failed. Check current password.', 'error');
        }
    });

    // ── 9. Save Preferences ──
    document.getElementById('btn-save-prefs').addEventListener('click', async () => {
        const data = getCurrentSettings();
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...stored, ...data }));
        await saveToServer('/api/settings/preferences', {
            currency: data.currency,
            priceAlerts: data.priceAlerts,
            orderNotif: data.orderNotif,
            promoNotif: data.promoNotif
        });
        toast('Preferences saved');
    });

    // ── 10. Export data ──
    document.getElementById('btn-export').addEventListener('click', () => {
        const data = {
            settings: JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
            cart:     JSON.parse(localStorage.getItem('gab_cart') || '[]'),
            advance:  JSON.parse(localStorage.getItem('aurum_cart') || '[]'),
            exported: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `gab-jewels-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast('Data exported successfully');
    });

    // ── 11. KYC upload ──
    const uploadBox  = document.getElementById('kyc-upload-box');
    const kycFile    = document.getElementById('kyc-file');
    const kycFileName = document.getElementById('kyc-file-name');

    uploadBox.addEventListener('click', () => kycFile.click());
    uploadBox.addEventListener('dragover', e => { e.preventDefault(); uploadBox.style.borderColor = 'var(--gold)'; });
    uploadBox.addEventListener('dragleave', () => { uploadBox.style.borderColor = ''; });
    uploadBox.addEventListener('drop', e => {
        e.preventDefault();
        uploadBox.style.borderColor = '';
        if (e.dataTransfer.files[0]) handleKycFile(e.dataTransfer.files[0]);
    });
    kycFile.addEventListener('change', () => {
        if (kycFile.files[0]) handleKycFile(kycFile.files[0]);
    });

    function handleKycFile(file) {
        if (file.size > 5 * 1024 * 1024) { toast('File must be under 5MB', 'error'); return; }
        kycFileName.textContent = file.name;
        uploadBox.style.borderColor = 'var(--gold)';
        toast('File selected: ' + file.name);
    }

    document.getElementById('btn-submit-kyc').addEventListener('click', () => {
        const pan = document.getElementById('pan-number').value.trim().toUpperCase();
        if (!pan || pan.length !== 10) { toast('Please enter a valid 10-character PAN number', 'error'); return; }
        if (!kycFile.files[0]) { toast('Please upload your PAN card document', 'error'); return; }
        // In production, send via FormData to server
        toast('KYC submitted for verification. We will notify you within 48 hours.');
    });

    // ── 12. Logout ── (fixed key to match index.html)
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('gab_logged_in'); // matches index.html key
        window.location.href = '../index.html';
    });

    // ── Init ──
    loadSettings();

});
const authLogic = {
    // 1. UI NAVIGATION
    showSignup: () => {
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('signup-view').style.display = 'block';
        document.getElementById('auth-title').innerText = "Join GAB Jewels";
    },

    // 2. TRIGGER TWILIO OTP
    triggerOTP: async () => {
        const phone = document.getElementById('s-phone').value;
        if (!phone || phone.length < 10) return alert("Enter a valid 10-digit number");

        const res = await fetch('/api/send-otp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phoneNumber: phone })
        });

        if (res.ok) {
            document.getElementById('signup-view').style.display = 'none';
            document.getElementById('otp-view').style.display = 'block';
        } else {
            alert("Error: Check your Twilio Geo-Permissions for India!");
        }
    },

    // 3. CHECK OTP CODE
    verifyOTP: async () => {
        const phone = document.getElementById('s-phone').value;
        const code = document.getElementById('otp-code').value;

        const res = await fetch('/api/verify-otp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phoneNumber: phone, code: code })
        });

        if (res.ok) {
            document.getElementById('otp-view').style.display = 'none';
            document.getElementById('create-pass-view').style.display = 'block';
        } else {
            alert("Wrong OTP code. Please check your phone!");
        }
    },

    // 4. LOGIN LOGIC (Checks LocalStorage)
    login: () => {
        const email = document.getElementById('l-email').value;
        const pass = document.getElementById('l-pass').value;
        const user = JSON.parse(localStorage.getItem(`user_${email}`));

        if (user && user.password === pass) {
            localStorage.setItem("isLoggedIn", "true");
            location.reload();
        } else {
            alert("Login failed. Please sign up first!");
        }
    },

    // 5. FINISH SIGNUP
    finalizeSignup: () => {
        const email = document.getElementById('s-email').value;
        const pass = document.getElementById('new-pass').value;
        localStorage.setItem(`user_${email}`, JSON.stringify({ email, password: pass }));
        localStorage.setItem("isLoggedIn", "true");
        location.reload();
    }
};

// Check if user is already logged in
if (localStorage.getItem("isLoggedIn") === "true") {
    document.getElementById('auth-modal').style.display = 'none';
}
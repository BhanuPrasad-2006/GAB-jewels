(function () {
    const token = localStorage.getItem('aurum_token');
    const role  = localStorage.getItem('aurum_role');

    // If not logged in as admin, redirect to main site login
    if (!token || role !== 'admin') {
        window.location.replace('/index.html');
        return;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('logoutBtn');
        if (btn) {
            btn.addEventListener('click', secureLogout);
        } else {
            console.warn('Logout button not found — check id="logoutBtn" exists in sidebar');
        }
    });

    async function secureLogout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch {
            // proceed with logout even if server call fails
        }

        // Clear everything
        localStorage.removeItem('aurum_token');
        localStorage.removeItem('aurum_role');
        localStorage.removeItem('isLoggedIn');
        sessionStorage.clear();

        // Redirect to main site login
        window.location.replace('/index.html');
    }

    window.AurumAuth = {
        token,
        role,
        headers() {
            return {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('aurum_token')}`,
            };
        },
        async apiFetch(url, options = {}) {
            const res = await fetch(url, {
                ...options,
                headers: { ...this.headers(), ...(options.headers || {}) },
            });
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('aurum_token');
                localStorage.removeItem('aurum_role');
                localStorage.removeItem('isLoggedIn');
                window.location.replace('/index.html');
                throw new Error('Unauthorized');
            }
            return res;
        },
    };
})();
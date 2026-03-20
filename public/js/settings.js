document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const tfaToggle = document.getElementById('2fa-toggle');

    // 1. Handle Profile Updates
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const userData = {
            name: profileForm.querySelector('input[type="text"]').value,
            email: profileForm.querySelector('input[type="email"]').value
        };

        try {
            const response = await fetch('http://localhost:3000/api/settings/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const result = await response.json();
            alert(result.message); // In a real app, use a toast notification
        } catch (error) {
            console.error("Connection Error:", error);
            alert("Could not connect to the server.");
        }
    });

    // 2. Handle 2FA Toggle (Security Feature)
    tfaToggle.addEventListener('change', async (e) => {
        const isEnabled = e.target.checked;
        
        const response = await fetch('http://localhost:3000/api/settings/toggle-2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: isEnabled })
        });

        const result = await response.json();
        console.log("2FA Status:", result.status);
    });
});
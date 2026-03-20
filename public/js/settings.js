document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const tfaToggle = document.getElementById('2fa-toggle');

    // 1. Update Profile Logic
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Gather data from your HTML inputs
        const name = profileForm.querySelector('input[type="text"]').value;
        const email = profileForm.querySelector('input[type="email"]').value;

        try {
            const response = await fetch('http://localhost:3000/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email })
            });

            const data = await response.json();

            if (response.ok) {
                alert("✨ " + data.message);
            } else {
                alert("❌ Error: " + data.message);
            }
        } catch (err) {
            console.error("Frontend Error:", err);
            alert("Could not connect to the server.");
        }
    });

    // 2. 2FA Toggle Logic
    tfaToggle.addEventListener('change', async (e) => {
        const isEnabled = e.target.checked;

        try {
            await fetch('http://localhost:3000/api/toggle-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ twoFactor: isEnabled })
            });
            console.log(`2FA Status changed to: ${isEnabled}`);
        } catch (err) {
            console.error("Security Update Failed:", err);
        }
    });
});
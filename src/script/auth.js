const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");

function showMessage(message) {
    authMessage.textContent = message;
    authMessage.classList.remove("hidden");
}

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    authMessage.textContent = "";
    authMessage.classList.add("hidden");

    const formData = new FormData(authForm);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirm-password");

    if (confirmPassword !== null && password !== confirmPassword) {
        showMessage("Konfirmasi password belum sama.");
        return;
    }

    const body = {
        email: formData.get("email"),
        password,
    };

    if (authForm.dataset.endpoint === "/api/register") {
        body.name = formData.get("name");
    }

    const submitButton = authForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";

    try {
        const response = await fetch(authForm.dataset.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(body),
        });
        const result = response.status === 204 ? {} : await response.json();

        if (!response.ok) {
            showMessage(result.error || "Tidak dapat memproses permintaan. Coba lagi.");
            return;
        }

        window.location.assign("./index.html");
    } catch (error) {
        console.error("Permintaan autentikasi gagal:", error);
        showMessage("Tidak bisa terhubung ke server. Pastikan server GaFont sedang berjalan.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = authForm.dataset.endpoint === "/api/register" ? "Buat akun" : "Masuk";
    }
});

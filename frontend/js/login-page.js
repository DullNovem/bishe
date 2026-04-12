document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const authError = document.getElementById('authError');
    const authSuccess = document.getElementById('authSuccess');
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const submitButton = loginForm?.querySelector('button[type="submit"]');

    if (authIsLoggedIn()) {
        window.location.replace('/dashboard');
        return;
    }

    const notice = authConsumeNotice();
    if (notice?.type === 'success' && authSuccess) {
        authSuccess.style.display = 'block';
        authSuccess.textContent = notice.message;
    } else if (notice?.type === 'error' && authError) {
        authError.style.display = 'block';
        authError.textContent = notice.message;
    }

    loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (authError) {
            authError.style.display = 'none';
            authError.textContent = '';
        }
        if (authSuccess) {
            authSuccess.style.display = 'none';
            authSuccess.textContent = '';
        }

        const username = String(usernameInput?.value || '').trim();
        const password = String(passwordInput?.value || '');

        if (!username) {
            if (authError) {
                authError.style.display = 'block';
                authError.textContent = '账号不能为空';
            }
            return;
        }
        if (!password) {
            if (authError) {
                authError.style.display = 'block';
                authError.textContent = '密码不能为空';
            }
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = '登录中...';
        }

        try {
            const response = await fetch(`${AUTH_API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok || data.code !== 200) {
                throw new Error(data.message || '登录失败');
            }

            authPersistUser(data.data);
            loginForm.reset();
            window.location.replace('/dashboard');
        } catch (error) {
            if (authError) {
                authError.style.display = 'block';
                authError.textContent = error.message || '登录失败';
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = '登录系统';
            }
        }
    });
});

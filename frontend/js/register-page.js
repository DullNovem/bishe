document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const authError = document.getElementById('authError');
    const authSuccess = document.getElementById('authSuccess');
    const submitButton = registerForm?.querySelector('button[type="submit"]');

    const fields = {
        username: document.getElementById('registerUsername'),
        displayName: document.getElementById('registerDisplayName'),
        phone: document.getElementById('registerPhone'),
        email: document.getElementById('registerEmail'),
        password: document.getElementById('registerPassword'),
        confirmPassword: document.getElementById('registerConfirmPassword')
    };

    const messages = {
        username: document.getElementById('registerUsernameMessage'),
        displayName: document.getElementById('registerDisplayNameMessage'),
        phone: document.getElementById('registerPhoneMessage'),
        email: document.getElementById('registerEmailMessage'),
        password: document.getElementById('registerPasswordMessage'),
        confirmPassword: document.getElementById('registerConfirmPasswordMessage')
    };

    if (authIsLoggedIn()) {
        window.location.replace('/dashboard');
        return;
    }

    if (authSuccess) {
        authSuccess.style.display = 'none';
        authSuccess.textContent = '';
    }

    const validators = {
        username(value) {
            const text = String(value || '').trim();
            if (!text) return { valid: false, message: '请输入用户名' };
            if (text.length < 4 || text.length > 32) return { valid: false, message: '用户名长度需在 4 到 32 位之间' };
            if (!/^[a-zA-Z0-9_]+$/.test(text)) return { valid: false, message: '用户名仅支持字母、数字和下划线' };
            return { valid: true, message: '用户名格式可用' };
        },
        displayName(value) {
            const text = String(value || '').trim();
            if (!text) return { valid: false, message: '请输入显示名称' };
            if (text.length < 2 || text.length > 32) return { valid: false, message: '显示名称长度需在 2 到 32 位之间' };
            return { valid: true, message: '显示名称可用' };
        },
        phone(value) {
            const text = String(value || '').trim();
            if (!text) return { valid: true, message: '手机号可选' };
            if (!/^1\d{10}$/.test(text)) return { valid: false, message: '请输入有效的 11 位手机号' };
            return { valid: true, message: '手机号格式正确' };
        },
        email(value) {
            const text = String(value || '').trim();
            if (!text) return { valid: true, message: '邮箱可选' };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { valid: false, message: '请输入有效的邮箱地址' };
            return { valid: true, message: '邮箱格式正确' };
        },
        password(value) {
            const text = String(value || '');
            if (!text) return { valid: false, message: '请输入密码' };
            if (text.length < 6 || text.length > 32) return { valid: false, message: '密码长度需在 6 到 32 位之间' };
            if (!/[A-Za-z]/.test(text) || !/\d/.test(text)) return { valid: false, message: '密码需同时包含字母和数字' };
            return { valid: true, message: '密码强度可用' };
        },
        confirmPassword(value) {
            const text = String(value || '');
            if (!text) return { valid: false, message: '请再次输入密码' };
            if (text !== String(fields.password?.value || '')) return { valid: false, message: '两次输入的密码不一致' };
            return { valid: true, message: '两次密码一致' };
        }
    };

    function applyValidation(name, forceShow) {
        const input = fields[name];
        const messageEl = messages[name];
        const state = validators[name](input?.value);
        const hasValue = String(input?.value || '').trim().length > 0;
        const shouldShow = forceShow || hasValue;

        if (!input || !messageEl) {
            return state.valid;
        }

        input.classList.toggle('invalid', shouldShow && !state.valid);
        messageEl.classList.remove('error', 'success');

        if (!shouldShow) {
            messageEl.textContent = '';
            return state.valid;
        }

        messageEl.textContent = state.message;
        messageEl.classList.add(state.valid ? 'success' : 'error');
        return state.valid;
    }

    Object.keys(fields).forEach((name) => {
        const input = fields[name];
        if (!input) {
            return;
        }
        input.addEventListener('input', () => applyValidation(name, false));
        input.addEventListener('blur', () => applyValidation(name, true));
    });

    registerForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (authError) {
            authError.style.display = 'none';
            authError.textContent = '';
        }

        const valid = Object.keys(fields).map((name) => applyValidation(name, true)).every(Boolean);
        if (!valid) {
            if (authError) {
                authError.style.display = 'block';
                authError.textContent = '请先按提示完善注册信息';
            }
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = '注册中...';
        }

        try {
            const response = await fetch(`${AUTH_API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: fields.username.value.trim(),
                    displayName: fields.displayName.value.trim(),
                    phone: fields.phone.value.trim(),
                    email: fields.email.value.trim(),
                    password: fields.password.value
                })
            });
            const data = await response.json();
            if (!response.ok || data.code !== 200) {
                throw new Error(data.message || '注册失败');
            }

            registerForm.reset();
            authSetNotice('success', '注册成功，请登录');
            window.location.replace('/login');
        } catch (error) {
            if (authError) {
                authError.style.display = 'block';
                authError.textContent = error.message || '注册失败';
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = '立即注册';
            }
        }
    });
});

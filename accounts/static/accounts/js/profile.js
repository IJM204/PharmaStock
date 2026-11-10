/* Gestion de la page HTML du profil utilisateur. */
(function () {
    'use strict';

    const {
        api,
        toast,
        formatDate,
        formatDateTime,
        escapeHtml,
        clearFormErrors,
        showFormErrors,
        setButtonLoading,
    } = window.PharmaStock;

    const PROFILE_URL = '/api/accounts/profile/';

    const ROLE_LABELS = {
        Admin: ['badge-info', 'Administrateur'],
        Cashier: ['badge-neutral', 'Caissier'],
        STOCK_Manager: ['badge-warning', 'Gestionnaire de stock'],
        PHARMASIST: ['badge-success', 'Pharmacien'],
    };

    const page = document.getElementById('profilePage');

    if (!page) {
        return;
    }

    const pageAlert = document.getElementById('profilePageAlert');
    const avatar = document.getElementById('profileAvatar');
    const displayName = document.getElementById('profileDisplayName');
    const displayUsername = document.getElementById('profileDisplayUsername');
    const displayBadges = document.getElementById('profileDisplayBadges');
    const usernameElement = document.getElementById('profileUsername');
    const roleElement = document.getElementById('profileRole');
    const statusElement = document.getElementById('profileStatus');
    const dateJoinedElement = document.getElementById('profileDateJoined');
    const lastLoginElement = document.getElementById('profileLastLogin');

    const form = document.getElementById('profileForm');
    const emailInput = document.getElementById('profileEmail');
    const firstNameInput = document.getElementById('profileFirstName');
    const lastNameInput = document.getElementById('profileLastName');
    const passwordInput = document.getElementById('profilePassword');
    const submitButton = document.getElementById('profileSubmitButton');

    function showPageError(message) {
        if (!pageAlert) {
            return;
        }

        pageAlert.textContent = message;
        pageAlert.classList.remove('hidden');
    }

    function hidePageError() {
        if (!pageAlert) {
            return;
        }

        pageAlert.textContent = '';
        pageAlert.classList.add('hidden');
    }

    function redirectToLogin() {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/api/dashboard/login/?next=${next}`;
    }

    function handleError(error, fallback = 'Une erreur est survenue.') {
        if (error && error.status === 401) {
            toast('Votre session a expiré. Veuillez vous reconnecter.', 'error');
            redirectToLogin();
            return;
        }

        const message = error.message || fallback;
        showPageError(message);
        toast(message, 'error');
    }

    function roleLabel(role) {
        const entry = ROLE_LABELS[role];

        return entry ? entry[1] : (role || '—');
    }

    function roleBadge(role) {
        const [className, label] = ROLE_LABELS[role] || ['badge-neutral', role || '—'];

        return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
    }

    function statusBadge(isActive) {
        return isActive
            ? '<span class="badge badge-success">Actif</span>'
            : '<span class="badge badge-danger">Inactif</span>';
    }

    function fullName(user) {
        return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }

    function renderProfile(user) {
        const name = fullName(user) || user.username;

        avatar.textContent = String(user.username || '?').charAt(0).toUpperCase();
        displayName.textContent = name;
        displayUsername.textContent = `@${user.username}`;
        displayBadges.innerHTML = `${roleBadge(user.role)} ${statusBadge(user.is_active)}`;
        usernameElement.textContent = user.username;
        roleElement.textContent = roleLabel(user.role);
        statusElement.textContent = user.is_active ? 'Actif' : 'Inactif';
        dateJoinedElement.textContent = formatDate(user.date_joined);
        lastLoginElement.textContent = user.last_login
            ? formatDateTime(user.last_login)
            : 'Jamais';

        emailInput.value = user.email || '';
        firstNameInput.value = user.first_name || '';
        lastNameInput.value = user.last_name || '';
        passwordInput.value = '';
    }

    async function loadProfile() {
        hidePageError();

        try {
            const user = await api(PROFILE_URL);
            renderProfile(user);
        } catch (error) {
            handleError(error, 'Impossible de charger votre profil.');
            displayName.textContent = 'Profil indisponible';
            displayUsername.textContent = '—';
            displayBadges.innerHTML = '';
        }
    }

    async function submitProfile(event) {
        event.preventDefault();
        hidePageError();
        clearFormErrors(form);

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            email: emailInput.value.trim(),
            first_name: firstNameInput.value.trim(),
            last_name: lastNameInput.value.trim(),
        };

        if (passwordInput.value) {
            payload.password = passwordInput.value;
        }

        setButtonLoading(submitButton, true, 'Enregistrement...');

        try {
            const user = await api(PROFILE_URL, {
                method: 'PATCH',
                body: payload,
            });

            renderProfile(user);
            toast('Vos informations ont été mises à jour.', 'success');
        } catch (error) {
            showFormErrors(form, error);
            handleError(error, 'Impossible de mettre à jour votre profil.');
        } finally {
            setButtonLoading(submitButton, false);
        }
    }

    if (form) {
        form.addEventListener('submit', submitProfile);
    }

    loadProfile();
})();

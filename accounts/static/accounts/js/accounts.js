/* Gestion de la page HTML des comptes utilisateurs. */
(function () {
    'use strict';

    const {
        api,
        toast,
        openModal,
        closeModal,
        confirmDialog,
        formatDate,
        formatDateTime,
        escapeHtml,
        debounce,
        clearFormErrors,
        showFormErrors,
        setButtonLoading,
        renderPagination,
        emptyState,
    } = window.PharmaStock;

    const USERS_URL = '/api/accounts/users/';
    const CREATE_URL = '/api/accounts/users/create/';
    const PAGE_SIZE = 10;

    const ROLE_LABELS = {
        Admin: ['badge-info', 'Administrateur'],
        Cashier: ['badge-neutral', 'Caissier'],
        STOCK_Manager: ['badge-warning', 'Gestionnaire de stock'],
        PHARMASIST: ['badge-success', 'Pharmacien'],
    };

    const page = document.getElementById('accountsPage');

    if (!page) {
        return;
    }

    const currentUserId = Number(page.dataset.currentUserId);
    const pageAlert = document.getElementById('accountsPageAlert');
    const searchInput = document.getElementById('accountSearch');
    const roleFilter = document.getElementById('accountRoleFilter');
    const statusFilter = document.getElementById('accountStatusFilter');
    const resetButton = document.getElementById('resetAccountFilters');
    const resultCount = document.getElementById('accountResultCount');
    const tableBody = document.getElementById('accountTableBody');
    const pagination = document.getElementById('accountPagination');
    const totalCount = document.getElementById('accountsTotalCount');
    const activeCount = document.getElementById('accountsActiveCount');
    const inactiveCount = document.getElementById('accountsInactiveCount');
    const adminCount = document.getElementById('accountsAdminCount');

    const addButton = document.getElementById('addAccountButton');
    const modal = document.getElementById('accountModal');
    const form = document.getElementById('accountForm');
    const modalTitle = document.getElementById('accountModalTitle');
    const hiddenId = document.getElementById('accountId');
    const usernameInput = document.getElementById('accountUsername');
    const emailInput = document.getElementById('accountEmail');
    const firstNameInput = document.getElementById('accountFirstName');
    const lastNameInput = document.getElementById('accountLastName');
    const roleSelect = document.getElementById('accountRole');
    const passwordInput = document.getElementById('accountPassword');
    const passwordRequired = document.getElementById('accountPasswordRequired');
    const passwordHelp = document.getElementById('accountPasswordHelp');
    const activeCheckbox = document.getElementById('accountIsActive');
    const activeHelp = document.getElementById('accountActiveHelp');
    const submitButton = document.getElementById('accountSubmitButton');

    let users = [];
    let filteredUsers = [];
    let currentPage = 1;
    let editingUserId = null;

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

        toast(error.message || fallback, 'error');
    }

    function asArray(data) {
        if (Array.isArray(data)) {
            return data;
        }

        return data && Array.isArray(data.results) ? data.results : [];
    }

    async function loadUsers() {
        hidePageError();

        try {
            const data = await api(USERS_URL);
            users = asArray(data);
            applyFilters(false);
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les utilisateurs.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les utilisateurs.');
        }
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

    function renderStats() {
        totalCount.textContent = String(users.length);
        activeCount.textContent = String(
            users.filter((user) => user.is_active).length
        );
        inactiveCount.textContent = String(
            users.filter((user) => !user.is_active).length
        );
        adminCount.textContent = String(
            users.filter((user) => user.role === 'Admin').length
        );
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();
        const role = roleFilter.value;
        const status = statusFilter.value;

        filteredUsers = users.filter((user) => {
            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            const matchesSearch = !search
                || (user.username || '').toLowerCase().includes(search)
                || fullName.toLowerCase().includes(search)
                || (user.email || '').toLowerCase().includes(search);
            const matchesRole = !role || user.role === role;
            const matchesStatus = !status
                || (status === 'active' && user.is_active)
                || (status === 'inactive' && !user.is_active);

            return matchesSearch && matchesRole && matchesStatus;
        });

        filteredUsers.sort((first, second) => (
            String(first.username).localeCompare(String(second.username), 'fr', {
                sensitivity: 'base',
            })
        ));

        if (resetPage) {
            currentPage = 1;
        }

        renderStats();
        renderTable();
        renderFilterCount();
    }

    function renderFilterCount() {
        if (!resultCount) {
            return;
        }

        resultCount.textContent = `${filteredUsers.length} utilisateur(s)`;
    }

    function renderTable() {
        const pages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));

        if (currentPage > pages) {
            currentPage = pages;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredUsers.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        ${emptyState(
                            'Aucun utilisateur ne correspond à votre recherche.',
                            'Aucun utilisateur'
                        )}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageItems.map((user) => {
                const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                const isSelf = Number(user.id) === currentUserId;
                const toggleTitle = isSelf
                    ? 'Vous ne pouvez pas désactiver votre propre compte.'
                    : (user.is_active ? 'Désactiver le compte' : 'Activer le compte');
                const toggleLabel = user.is_active ? '⏻' : '✓';

                return `
                    <tr>
                        <td>
                            <span class="cell-main">
                                ${escapeHtml(user.username)}${isSelf ? ' (vous)' : ''}
                            </span>
                            <span class="cell-sub">${escapeHtml(fullName || '—')}</span>
                        </td>
                        <td>${escapeHtml(user.email || '—')}</td>
                        <td>${roleBadge(user.role)}</td>
                        <td>${statusBadge(user.is_active)}</td>
                        <td>${user.last_login ? formatDateTime(user.last_login) : 'Jamais'}</td>
                        <td>${formatDate(user.date_joined)}</td>
                        <td class="text-right">
                            <div class="table-actions">
                                <button
                                    type="button"
                                    class="btn btn-icon"
                                    data-edit-user="${user.id}"
                                    title="Modifier l’utilisateur"
                                    aria-label="Modifier ${escapeHtml(user.username)}"
                                >✎</button>
                                <button
                                    type="button"
                                    class="btn btn-icon ${user.is_active ? 'danger' : ''}"
                                    data-toggle-user="${user.id}"
                                    title="${toggleTitle}"
                                    aria-label="${toggleTitle}"
                                    ${isSelf ? 'disabled' : ''}
                                >${toggleLabel}</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        renderPagination(pagination, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            total: filteredUsers.length,
            onChange: (newPage) => {
                currentPage = newPage;
                renderTable();
            },
        });
    }

    function findUser(userId) {
        return users.find((user) => Number(user.id) === Number(userId)) || null;
    }

    function resetModalState() {
        form.reset();
        clearFormErrors(form);
        hiddenId.value = '';
        editingUserId = null;
        usernameInput.disabled = false;
        usernameInput.required = true;
        roleSelect.disabled = false;
        activeCheckbox.disabled = false;
        passwordInput.required = true;
        passwordRequired.classList.remove('hidden');
        passwordHelp.textContent = 'Au moins 8 caractères.';
        activeHelp.textContent = 'Un compte inactif ne peut pas se connecter.';
        submitButton.textContent = 'Créer l’utilisateur';
        modalTitle.textContent = 'Nouvel utilisateur';
    }

    function openCreateModal() {
        resetModalState();
        usernameInput.value = '';
        emailInput.value = '';
        firstNameInput.value = '';
        lastNameInput.value = '';
        roleSelect.value = 'PHARMASIST';
        passwordInput.value = '';
        activeCheckbox.checked = true;
        openModal(modal);
    }

    function openEditModal(user) {
        resetModalState();
        editingUserId = Number(user.id);
        hiddenId.value = String(user.id);
        modalTitle.textContent = `Modifier ${user.username}`;
        usernameInput.value = user.username;
        emailInput.value = user.email || '';
        firstNameInput.value = user.first_name || '';
        lastNameInput.value = user.last_name || '';
        roleSelect.value = user.role;
        passwordInput.value = '';
        activeCheckbox.checked = Boolean(user.is_active);
        passwordInput.required = false;
        passwordRequired.classList.add('hidden');
        passwordHelp.textContent = 'Laisser vide pour conserver le mot de passe actuel.';
        submitButton.textContent = 'Enregistrer les modifications';

        if (Number(user.id) === currentUserId) {
            roleSelect.disabled = true;
            activeCheckbox.disabled = true;
            activeHelp.textContent = 'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre compte.';
        }

        openModal(modal);
    }

    function collectPayload() {
        const payload = {
            email: emailInput.value.trim(),
            first_name: firstNameInput.value.trim(),
            last_name: lastNameInput.value.trim(),
        };

        if (!roleSelect.disabled) {
            payload.role = roleSelect.value;
        }

        if (!activeCheckbox.disabled) {
            payload.is_active = activeCheckbox.checked;
        }

        if (!usernameInput.disabled) {
            payload.username = usernameInput.value.trim();
        }

        if (passwordInput.value) {
            payload.password = passwordInput.value;
        }

        return payload;
    }

    async function submitAccount(event) {
        event.preventDefault();
        clearFormErrors(form);

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const isEdit = Boolean(editingUserId);
        const payload = collectPayload();

        if (!isEdit && !payload.password) {
            showFormErrors(form, {
                message: 'Le mot de passe est obligatoire pour un nouveau compte.',
                data: { password: ['Le mot de passe est obligatoire.'] },
            });
            return;
        }

        const url = isEdit
            ? `/api/accounts/users/${editingUserId}/`
            : CREATE_URL;
        const method = isEdit ? 'PATCH' : 'POST';

        setButtonLoading(
            submitButton,
            true,
            isEdit ? 'Enregistrement...' : 'Création...'
        );

        try {
            await api(url, { method, body: payload });
            closeModal(modal);
            toast(
                isEdit
                    ? 'Le compte a été mis à jour.'
                    : 'Le nouvel utilisateur a été créé.',
                'success'
            );
            await loadUsers();
        } catch (error) {
            showFormErrors(form, error);
            handleError(error, 'Impossible d’enregistrer le compte.');
        } finally {
            setButtonLoading(submitButton, false);
            submitButton.textContent = isEdit
                ? 'Enregistrer les modifications'
                : 'Créer l’utilisateur';
        }
    }

    async function toggleUser(button) {
        const user = findUser(button.dataset.toggleUser);

        if (!user) {
            return;
        }

        if (Number(user.id) === currentUserId) {
            toast('Vous ne pouvez pas désactiver votre propre compte.', 'warning');
            return;
        }

        const action = user.is_active ? 'désactiver' : 'activer';
        const confirmed = await confirmDialog({
            title: user.is_active ? 'Désactiver le compte' : 'Activer le compte',
            message: `Voulez-vous ${action} le compte de « ${user.username} » ?`,
            confirmText: user.is_active ? 'Désactiver' : 'Activer',
            danger: user.is_active,
        });

        if (!confirmed) {
            return;
        }

        setButtonLoading(button, true, '...');

        try {
            await api(`/api/accounts/users/${user.id}/`, {
                method: 'PATCH',
                body: { is_active: !user.is_active },
            });
            toast(
                user.is_active
                    ? 'Le compte a été désactivé.'
                    : 'Le compte a été activé.',
                'success'
            );
            await loadUsers();
        } catch (error) {
            handleError(error, 'Impossible de modifier le statut du compte.');
            setButtonLoading(button, false);
        }
    }

    if (addButton) {
        addButton.addEventListener('click', openCreateModal);
    }

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const editButton = event.target.closest('[data-edit-user]');

            if (editButton) {
                const user = findUser(editButton.dataset.editUser);

                if (user) {
                    openEditModal(user);
                }

                return;
            }

            const toggleButton = event.target.closest('[data-toggle-user]');

            if (toggleButton) {
                toggleUser(toggleButton);
            }
        });
    }

    if (form) {
        form.addEventListener('submit', submitAccount);
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => applyFilters(true), 250));
    }

    if (roleFilter) {
        roleFilter.addEventListener('change', () => applyFilters(true));
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => applyFilters(true));
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            searchInput.value = '';
            roleFilter.value = '';
            statusFilter.value = '';
            applyFilters(true);
        });
    }

    loadUsers();
})();

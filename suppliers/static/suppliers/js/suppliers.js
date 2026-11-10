/* Gestion de la page HTML des fournisseurs. */
(function () {
    'use strict';

    const {
        api,
        toast,
        openModal,
        closeModal,
        confirmDialog,
        escapeHtml,
        debounce,
        clearFormErrors,
        showFormErrors,
        setButtonLoading,
        renderPagination,
        emptyState,
    } = window.PharmaStock;

    const SUPPLIERS_URL = '/api/suppliers/suppliers/';
    const PAGE_SIZE = 10;

    const page = document.getElementById('supplierPage');

    if (!page) {
        return;
    }

    const canManage = page.dataset.canManage === 'true';

    const pageAlert = document.getElementById('supplierPageAlert');
    const searchInput = document.getElementById('supplierSearch');
    const statusFilter = document.getElementById('supplierStatusFilter');
    const resetButton = document.getElementById('resetSupplierFilters');
    const resultCount = document.getElementById('supplierResultCount');
    const tableBody = document.getElementById('supplierTableBody');
    const pagination = document.getElementById('supplierPagination');
    const totalCount = document.getElementById('supplierTotalCount');
    const activeCount = document.getElementById('supplierActiveCount');
    const inactiveCount = document.getElementById('supplierInactiveCount');

    const addButton = document.getElementById('addSupplierButton');
    const modal = document.getElementById('supplierModal');
    const form = document.getElementById('supplierForm');
    const modalTitle = document.getElementById('supplierModalTitle');
    const submitButton = document.getElementById('supplierSubmitButton');

    let suppliers = [];
    let filteredSuppliers = [];
    let currentPage = 1;

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

    async function loadData() {
        hidePageError();

        try {
            const data = await api(SUPPLIERS_URL);
            suppliers = Array.isArray(data) ? data : (data.results || []);
            applyFilters(false);
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les fournisseurs.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les fournisseurs.');
        }
    }

    function renderStats() {
        totalCount.textContent = String(suppliers.length);
        activeCount.textContent = String(
            suppliers.filter((supplier) => supplier.is_active).length
        );
        inactiveCount.textContent = String(
            suppliers.filter((supplier) => !supplier.is_active).length
        );
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();
        const status = statusFilter.value;

        filteredSuppliers = suppliers.filter((supplier) => {
            const matchesSearch = !search
                || (supplier.name || '').toLowerCase().includes(search)
                || (supplier.contact_person || '').toLowerCase().includes(search)
                || (supplier.phone || '').toLowerCase().includes(search)
                || (supplier.email || '').toLowerCase().includes(search)
                || (supplier.address || '').toLowerCase().includes(search);

            const matchesStatus = !status
                || (status === 'active' && supplier.is_active)
                || (status === 'inactive' && !supplier.is_active);

            return matchesSearch && matchesStatus;
        });

        filteredSuppliers.sort((first, second) => (
            first.name.localeCompare(second.name, 'fr', { sensitivity: 'base' })
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

        resultCount.textContent = `${filteredSuppliers.length} fournisseur(s)`;
    }

    function actionButtons(supplier) {
        if (!canManage) {
            return '<span class="muted">—</span>';
        }

        const toggleLabel = supplier.is_active ? 'Désactiver' : 'Activer';
        const toggleSymbol = supplier.is_active ? '⊘' : '✓';

        return `
            <div class="table-actions">
                <button
                    type="button"
                    class="btn btn-icon"
                    data-action="edit"
                    data-id="${supplier.id}"
                    title="Modifier"
                    aria-label="Modifier ${escapeHtml(supplier.name)}"
                >✎</button>
                <button
                    type="button"
                    class="btn btn-icon"
                    data-action="toggle"
                    data-id="${supplier.id}"
                    title="${toggleLabel}"
                    aria-label="${toggleLabel} ${escapeHtml(supplier.name)}"
                >${toggleSymbol}</button>
                <button
                    type="button"
                    class="btn btn-icon danger"
                    data-action="delete"
                    data-id="${supplier.id}"
                    title="Supprimer"
                    aria-label="Supprimer ${escapeHtml(supplier.name)}"
                >🗑</button>
            </div>
        `;
    }

    function renderTable() {
        const pages = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE));

        if (currentPage > pages) {
            currentPage = pages;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredSuppliers.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        ${emptyState(
                            'Aucun fournisseur ne correspond à votre recherche.',
                            'Aucun fournisseur'
                        )}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageItems.map((supplier) => `
                <tr>
                    <td>
                        <span class="cell-main">${escapeHtml(supplier.name)}</span>
                        <span class="cell-sub">${escapeHtml(supplier.contact_person || 'Contact non renseigné')}</span>
                    </td>
                    <td>${escapeHtml(supplier.phone || '—')}</td>
                    <td>${escapeHtml(supplier.email || '—')}</td>
                    <td>${escapeHtml(supplier.address || '—')}</td>
                    <td>
                        ${supplier.is_active
                            ? '<span class="badge badge-success">Actif</span>'
                            : '<span class="badge badge-neutral">Inactif</span>'}
                    </td>
                    <td class="text-right">${actionButtons(supplier)}</td>
                </tr>
            `).join('');
        }

        renderPagination(pagination, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            total: filteredSuppliers.length,
            onChange: (newPage) => {
                currentPage = newPage;
                renderTable();
            },
        });
    }

    function resetForm() {
        if (!form) {
            return;
        }

        form.reset();
        clearFormErrors(form);
        document.getElementById('supplierId').value = '';
        document.getElementById('supplierIsActive').checked = true;
    }

    function openCreateModal() {
        if (!modal || !form) {
            return;
        }

        resetForm();
        modalTitle.textContent = 'Nouveau fournisseur';
        submitButton.textContent = 'Enregistrer';
        openModal(modal);
    }

    function openEditModal(supplierId) {
        const supplier = suppliers.find(
            (item) => Number(item.id) === Number(supplierId)
        );

        if (!supplier || !modal || !form) {
            return;
        }

        resetForm();
        modalTitle.textContent = 'Modifier le fournisseur';
        submitButton.textContent = 'Mettre à jour';

        document.getElementById('supplierId').value = String(supplier.id);
        document.getElementById('supplierName').value = supplier.name || '';
        document.getElementById('supplierContact').value = supplier.contact_person || '';
        document.getElementById('supplierPhone').value = supplier.phone || '';
        document.getElementById('supplierEmail').value = supplier.email || '';
        document.getElementById('supplierAddress').value = supplier.address || '';
        document.getElementById('supplierIsActive').checked = Boolean(supplier.is_active);

        openModal(modal);
    }

    async function submitForm(event) {
        event.preventDefault();

        if (!form) {
            return;
        }

        clearFormErrors(form);

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const supplierId = document.getElementById('supplierId').value;
        const payload = {
            name: document.getElementById('supplierName').value.trim(),
            contact_person: document.getElementById('supplierContact').value.trim(),
            phone: document.getElementById('supplierPhone').value.trim(),
            email: document.getElementById('supplierEmail').value.trim(),
            address: document.getElementById('supplierAddress').value.trim(),
            is_active: document.getElementById('supplierIsActive').checked,
        };

        const isEditing = Boolean(supplierId);
        const url = isEditing ? `${SUPPLIERS_URL}${supplierId}/` : SUPPLIERS_URL;

        setButtonLoading(submitButton, true, 'Enregistrement...');

        try {
            await api(url, {
                method: isEditing ? 'PATCH' : 'POST',
                body: payload,
            });

            closeModal(modal);
            toast(
                isEditing
                    ? 'Le fournisseur a été mis à jour.'
                    : 'Le fournisseur a été ajouté.',
                'success'
            );

            await loadData();
        } catch (error) {
            showFormErrors(form, error);
            handleError(error, 'Impossible d’enregistrer le fournisseur.');
        } finally {
            setButtonLoading(submitButton, false);
        }
    }

    async function toggleSupplier(supplierId) {
        const supplier = suppliers.find(
            (item) => Number(item.id) === Number(supplierId)
        );

        if (!supplier) {
            return;
        }

        if (supplier.is_active) {
            const confirmed = await confirmDialog({
                title: 'Désactiver le fournisseur',
                message: `Désactiver « ${supplier.name} » ?`,
                confirmText: 'Désactiver',
                danger: true,
            });

            if (!confirmed) {
                return;
            }
        }

        try {
            await api(`${SUPPLIERS_URL}${supplier.id}/`, {
                method: 'PATCH',
                body: { is_active: !supplier.is_active },
            });

            toast(
                supplier.is_active
                    ? 'Le fournisseur a été désactivé.'
                    : 'Le fournisseur a été activé.',
                'success'
            );

            await loadData();
        } catch (error) {
            handleError(error, 'Impossible de modifier le statut du fournisseur.');
        }
    }

    async function deleteSupplier(supplierId) {
        const supplier = suppliers.find(
            (item) => Number(item.id) === Number(supplierId)
        );

        if (!supplier) {
            return;
        }

        const confirmed = await confirmDialog({
            title: 'Supprimer le fournisseur',
            message: `Supprimer définitivement « ${supplier.name} » ? Cette action est irréversible.`,
            confirmText: 'Supprimer',
            danger: true,
        });

        if (!confirmed) {
            return;
        }

        try {
            await api(`${SUPPLIERS_URL}${supplier.id}/`, {
                method: 'DELETE',
            });

            toast('Le fournisseur a été supprimé.', 'success');
            await loadData();
        } catch (error) {
            if (error.status === 500 || error.status === 409) {
                toast(
                    'Suppression impossible : ce fournisseur est lié à des achats. Désactivez-le plutôt.',
                    'error'
                );
                return;
            }

            handleError(error, 'Impossible de supprimer le fournisseur.');
        }
    }

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');

            if (!button) {
                return;
            }

            const supplierId = button.dataset.id;

            if (button.dataset.action === 'edit') {
                openEditModal(supplierId);
            } else if (button.dataset.action === 'toggle') {
                toggleSupplier(supplierId);
            } else if (button.dataset.action === 'delete') {
                deleteSupplier(supplierId);
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => applyFilters(true), 250));
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => applyFilters(true));
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            searchInput.value = '';
            statusFilter.value = '';
            applyFilters(true);
        });
    }

    if (addButton) {
        addButton.addEventListener('click', openCreateModal);
    }

    if (form) {
        form.addEventListener('submit', submitForm);
    }

    loadData();
})();

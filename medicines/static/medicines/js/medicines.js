/* Gestion de la page HTML des médicaments. */
(function () {
    'use strict';

    const {
        api,
        toast,
        openModal,
        closeModal,
        confirmDialog,
        formatMoney,
        escapeHtml,
        debounce,
        clearFormErrors,
        showFormErrors,
        setButtonLoading,
        renderPagination,
        emptyState,
        loadingState,
    } = window.PharmaStock;

    const MEDICINES_URL = '/api/medicines/medicines/';
    const CATEGORIES_URL = '/api/medicines/categories/';
    const PAGE_SIZE = 10;

    const FORM_LABELS = {
        TABLET: 'Comprimé',
        SYRUP: 'Sirop',
        CAPSULE: 'Gélule',
        INJECTION: 'Injectable',
        CREAM: 'Crème',
        OTHERS: 'Autres',
    };

    const page = document.getElementById('medicinePage');

    if (!page) {
        return;
    }

    const canManage = page.dataset.canManage === 'true';

    const pageAlert = document.getElementById('medicinePageAlert');
    const searchInput = document.getElementById('medicineSearch');
    const categoryFilter = document.getElementById('medicineCategoryFilter');
    const statusFilter = document.getElementById('medicineStatusFilter');
    const resetButton = document.getElementById('resetMedicineFilters');
    const resultCount = document.getElementById('medicineResultCount');
    const tableBody = document.getElementById('medicineTableBody');
    const pagination = document.getElementById('medicinePagination');
    const totalCount = document.getElementById('medicineTotalCount');
    const activeCount = document.getElementById('medicineActiveCount');
    const categoryCount = document.getElementById('medicineCategoryCount');

    const addButton = document.getElementById('addMedicineButton');
    const modal = document.getElementById('medicineModal');
    const form = document.getElementById('medicineForm');
    const modalTitle = document.getElementById('medicineModalTitle');
    const submitButton = document.getElementById('medicineSubmitButton');

    let medicines = [];
    let categories = [];
    let filteredMedicines = [];
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

    function populateCategoryOptions() {
        if (!categoryFilter) {
            return;
        }

        const previousFilter = categoryFilter.value;

        categoryFilter.innerHTML = '<option value="">Toutes les catégories</option>';

        categories.forEach((category) => {
            const option = document.createElement('option');
            option.value = String(category.id);
            option.textContent = category.name;
            categoryFilter.appendChild(option);
        });

        if (
            previousFilter
            && categories.some((category) => String(category.id) === previousFilter)
        ) {
            categoryFilter.value = previousFilter;
        }

        const formCategory = document.getElementById('medicineCategory');

        if (formCategory) {
            const previousValue = formCategory.value;

            formCategory.innerHTML = '<option value="">Sélectionner une catégorie</option>';

            categories.forEach((category) => {
                const option = document.createElement('option');
                option.value = String(category.id);
                option.textContent = category.name;
                formCategory.appendChild(option);
            });

            if (
                previousValue
                && categories.some((category) => String(category.id) === previousValue)
            ) {
                formCategory.value = previousValue;
            }
        }
    }

    async function loadData() {
        hidePageError();

        try {
            const [medicinesData, categoriesData] = await Promise.all([
                api(MEDICINES_URL),
                api(CATEGORIES_URL),
            ]);

            medicines = Array.isArray(medicinesData)
                ? medicinesData
                : (medicinesData.results || []);

            categories = Array.isArray(categoriesData)
                ? categoriesData
                : (categoriesData.results || []);

            populateCategoryOptions();
            applyFilters(false);
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les médicaments.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les médicaments.');
        }
    }

    function renderStats() {
        totalCount.textContent = String(medicines.length);
        activeCount.textContent = String(
            medicines.filter((medicine) => medicine.is_active).length
        );
        categoryCount.textContent = String(categories.length);
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();
        const category = categoryFilter.value;
        const status = statusFilter.value;

        filteredMedicines = medicines.filter((medicine) => {
            const matchesSearch = !search
                || medicine.name.toLowerCase().includes(search)
                || (medicine.generic_name || '').toLowerCase().includes(search)
                || (medicine.dosage || '').toLowerCase().includes(search);

            const matchesCategory = !category
                || String(medicine.category) === category;

            const matchesStatus = !status
                || (status === 'active' && medicine.is_active)
                || (status === 'inactive' && !medicine.is_active);

            return matchesSearch && matchesCategory && matchesStatus;
        });

        filteredMedicines.sort((first, second) => (
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

        resultCount.textContent = `${filteredMedicines.length} médicament(s)`;
    }

    function statusBadge(isActive) {
        return isActive
            ? '<span class="badge badge-success">Actif</span>'
            : '<span class="badge badge-neutral">Inactif</span>';
    }

    function actionButtons(medicine) {
        if (!canManage) {
            return '<span class="muted">—</span>';
        }

        const toggleLabel = medicine.is_active ? 'Désactiver' : 'Activer';
        const toggleSymbol = medicine.is_active ? '⊘' : '✓';

        return `
            <div class="table-actions">
                <button
                    type="button"
                    class="btn btn-icon"
                    data-action="edit"
                    data-id="${medicine.id}"
                    title="Modifier"
                    aria-label="Modifier ${escapeHtml(medicine.name)}"
                >✎</button>
                <button
                    type="button"
                    class="btn btn-icon"
                    data-action="toggle"
                    data-id="${medicine.id}"
                    title="${toggleLabel}"
                    aria-label="${toggleLabel} ${escapeHtml(medicine.name)}"
                >${toggleSymbol}</button>
                <button
                    type="button"
                    class="btn btn-icon danger"
                    data-action="delete"
                    data-id="${medicine.id}"
                    title="Supprimer"
                    aria-label="Supprimer ${escapeHtml(medicine.name)}"
                >🗑</button>
            </div>
        `;
    }

    function renderTable() {
        const pages = Math.max(1, Math.ceil(filteredMedicines.length / PAGE_SIZE));

        if (currentPage > pages) {
            currentPage = pages;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredMedicines.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        ${emptyState(
                            'Aucun médicament ne correspond à votre recherche.',
                            'Aucun médicament'
                        )}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageItems.map((medicine) => `
                <tr>
                    <td>
                        <span class="cell-main">${escapeHtml(medicine.name)}</span>
                        <span class="cell-sub">${escapeHtml(medicine.generic_name || 'Nom générique non renseigné')}</span>
                    </td>
                    <td>${escapeHtml(medicine.dosage || '—')}</td>
                    <td>${escapeHtml(FORM_LABELS[medicine.form] || medicine.form)}</td>
                    <td>${escapeHtml(medicine.category_name || '—')}</td>
                    <td class="money">${formatMoney(medicine.unit_price)}</td>
                    <td>${statusBadge(medicine.is_active)}</td>
                    <td class="text-right">${actionButtons(medicine)}</td>
                </tr>
            `).join('');
        }

        renderPagination(pagination, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            total: filteredMedicines.length,
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
        document.getElementById('medicineId').value = '';
        document.getElementById('medicineFormSelect').value = 'TABLET';
        document.getElementById('medicineIsActive').checked = true;

        const categorySelect = document.getElementById('medicineCategory');

        if (categorySelect) {
            categorySelect.value = '';
        }
    }

    function openCreateModal() {
        if (!modal || !form) {
            return;
        }

        if (categories.length === 0) {
            toast(
                'Créez d’abord une catégorie avant d’ajouter un médicament.',
                'warning'
            );
            return;
        }

        resetForm();
        modalTitle.textContent = 'Nouveau médicament';
        submitButton.textContent = 'Enregistrer';
        openModal(modal);
    }

    function openEditModal(medicineId) {
        const medicine = medicines.find(
            (item) => Number(item.id) === Number(medicineId)
        );

        if (!medicine || !modal || !form) {
            return;
        }

        resetForm();
        modalTitle.textContent = 'Modifier le médicament';
        submitButton.textContent = 'Mettre à jour';

        document.getElementById('medicineId').value = String(medicine.id);
        document.getElementById('medicineName').value = medicine.name || '';
        document.getElementById('medicineGenericName').value = medicine.generic_name || '';
        document.getElementById('medicineDosage').value = medicine.dosage || '';
        document.getElementById('medicineFormSelect').value = medicine.form || 'TABLET';
        document.getElementById('medicineCategory').value = String(medicine.category);
        document.getElementById('medicinePrice').value = medicine.unit_price;
        document.getElementById('medicineDescription').value = medicine.description || '';
        document.getElementById('medicineIsActive').checked = Boolean(medicine.is_active);

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

        const medicineId = document.getElementById('medicineId').value;
        const categoryValue = document.getElementById('medicineCategory').value;

        if (!categoryValue) {
            const categoryError = form.querySelector('[data-error-for="category"]');

            if (categoryError) {
                categoryError.textContent = 'Sélectionnez une catégorie.';
                categoryError.classList.remove('hidden');
            }

            return;
        }

        const payload = {
            name: document.getElementById('medicineName').value.trim(),
            generic_name: document.getElementById('medicineGenericName').value.trim(),
            dosage: document.getElementById('medicineDosage').value.trim(),
            form: document.getElementById('medicineFormSelect').value,
            category: Number(categoryValue),
            unit_price: document.getElementById('medicinePrice').value,
            description: document.getElementById('medicineDescription').value.trim(),
            is_active: document.getElementById('medicineIsActive').checked,
        };

        const isEditing = Boolean(medicineId);
        const url = isEditing ? `${MEDICINES_URL}${medicineId}/` : MEDICINES_URL;

        setButtonLoading(submitButton, true, 'Enregistrement...');

        try {
            await api(url, {
                method: isEditing ? 'PATCH' : 'POST',
                body: payload,
            });

            closeModal(modal);
            toast(
                isEditing
                    ? 'Le médicament a été mis à jour.'
                    : 'Le médicament a été ajouté.',
                'success'
            );

            await loadData();
        } catch (error) {
            showFormErrors(form, error);
            handleError(error, 'Impossible d’enregistrer le médicament.');
        } finally {
            setButtonLoading(submitButton, false);
        }
    }

    async function toggleMedicine(medicineId) {
        const medicine = medicines.find(
            (item) => Number(item.id) === Number(medicineId)
        );

        if (!medicine) {
            return;
        }

        if (medicine.is_active) {
            const confirmed = await confirmDialog({
                title: 'Désactiver le médicament',
                message: `Désactiver « ${medicine.name} » ? Il ne sera plus proposé lors des ventes.`,
                confirmText: 'Désactiver',
                danger: true,
            });

            if (!confirmed) {
                return;
            }
        }

        try {
            await api(`${MEDICINES_URL}${medicine.id}/`, {
                method: 'PATCH',
                body: { is_active: !medicine.is_active },
            });

            toast(
                medicine.is_active
                    ? 'Le médicament a été désactivé.'
                    : 'Le médicament a été activé.',
                'success'
            );

            await loadData();
        } catch (error) {
            handleError(error, 'Impossible de modifier le statut du médicament.');
        }
    }

    async function deleteMedicine(medicineId) {
        const medicine = medicines.find(
            (item) => Number(item.id) === Number(medicineId)
        );

        if (!medicine) {
            return;
        }

        const confirmed = await confirmDialog({
            title: 'Supprimer le médicament',
            message: `Supprimer définitivement « ${medicine.name} » ? Cette action est irréversible.`,
            confirmText: 'Supprimer',
            danger: true,
        });

        if (!confirmed) {
            return;
        }

        try {
            await api(`${MEDICINES_URL}${medicine.id}/`, {
                method: 'DELETE',
            });

            toast('Le médicament a été supprimé.', 'success');
            await loadData();
        } catch (error) {
            if (error.status === 500 || error.status === 409) {
                toast(
                    'Suppression impossible : ce médicament est utilisé par des lots ou des ventes. Désactivez-le plutôt.',
                    'error'
                );
                return;
            }

            handleError(error, 'Impossible de supprimer le médicament.');
        }
    }

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');

            if (!button) {
                return;
            }

            const medicineId = button.dataset.id;

            if (button.dataset.action === 'edit') {
                openEditModal(medicineId);
            } else if (button.dataset.action === 'toggle') {
                toggleMedicine(medicineId);
            } else if (button.dataset.action === 'delete') {
                deleteMedicine(medicineId);
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => applyFilters(true), 250));
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => applyFilters(true));
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => applyFilters(true));
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            searchInput.value = '';
            categoryFilter.value = '';
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

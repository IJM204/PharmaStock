/* Gestion de la page HTML des catégories de médicaments. */
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

    const CATEGORIES_URL = '/api/medicines/categories/';
    const PAGE_SIZE = 10;

    const page = document.getElementById('categoryPage');

    if (!page) {
        return;
    }

    const canManage = page.dataset.canManage === 'true';

    const pageAlert = document.getElementById('categoryPageAlert');
    const searchInput = document.getElementById('categorySearch');
    const resetButton = document.getElementById('resetCategoryFilters');
    const resultCount = document.getElementById('categoryResultCount');
    const tableBody = document.getElementById('categoryTableBody');
    const pagination = document.getElementById('categoryPagination');
    const totalCount = document.getElementById('categoryTotalCount');
    const medicineCount = document.getElementById('categoryMedicineCount');

    const addButton = document.getElementById('addCategoryButton');
    const modal = document.getElementById('categoryModal');
    const form = document.getElementById('categoryForm');
    const modalTitle = document.getElementById('categoryModalTitle');
    const submitButton = document.getElementById('categorySubmitButton');

    let categories = [];
    let filteredCategories = [];
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
            const data = await api(CATEGORIES_URL);

            categories = Array.isArray(data) ? data : (data.results || []);
            applyFilters(false);
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les catégories.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les catégories.');
        }
    }

    function renderStats() {
        totalCount.textContent = String(categories.length);
        medicineCount.textContent = String(
            categories.reduce(
                (total, category) => total + Number(category.medicines_count || 0),
                0
            )
        );
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();

        filteredCategories = categories.filter((category) => (
            !search
            || category.name.toLowerCase().includes(search)
            || (category.description || '').toLowerCase().includes(search)
        ));

        filteredCategories.sort((first, second) => (
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

        resultCount.textContent = `${filteredCategories.length} catégorie(s)`;
    }

    function actionButtons(category) {
        if (!canManage) {
            return '<span class="muted">—</span>';
        }

        const hasMedicines = Number(category.medicines_count || 0) > 0;
        const deleteTitle = hasMedicines
            ? 'Suppression impossible : cette catégorie contient des médicaments'
            : 'Supprimer';

        return `
            <div class="table-actions">
                <button
                    type="button"
                    class="btn btn-icon"
                    data-action="edit"
                    data-id="${category.id}"
                    title="Modifier"
                    aria-label="Modifier ${escapeHtml(category.name)}"
                >✎</button>
                <button
                    type="button"
                    class="btn btn-icon danger"
                    data-action="delete"
                    data-id="${category.id}"
                    title="${deleteTitle}"
                    aria-label="${deleteTitle}"
                    ${hasMedicines ? 'disabled' : ''}
                >🗑</button>
            </div>
        `;
    }

    function renderTable() {
        const pages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));

        if (currentPage > pages) {
            currentPage = pages;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredCategories.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4">
                        ${emptyState(
                            'Aucune catégorie ne correspond à votre recherche.',
                            'Aucune catégorie'
                        )}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageItems.map((category) => `
                <tr>
                    <td>
                        <span class="cell-main">${escapeHtml(category.name)}</span>
                    </td>
                    <td>${escapeHtml(category.description || '—')}</td>
                    <td>
                        <span class="badge ${Number(category.medicines_count) > 0 ? 'badge-info' : 'badge-neutral'}">
                            ${Number(category.medicines_count || 0)} médicament(s)
                        </span>
                    </td>
                    <td class="text-right">${actionButtons(category)}</td>
                </tr>
            `).join('');
        }

        renderPagination(pagination, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            total: filteredCategories.length,
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
        document.getElementById('categoryId').value = '';
    }

    function openCreateModal() {
        if (!modal || !form) {
            return;
        }

        resetForm();
        modalTitle.textContent = 'Nouvelle catégorie';
        submitButton.textContent = 'Enregistrer';
        openModal(modal);
    }

    function openEditModal(categoryId) {
        const category = categories.find(
            (item) => Number(item.id) === Number(categoryId)
        );

        if (!category || !modal || !form) {
            return;
        }

        resetForm();
        modalTitle.textContent = 'Modifier la catégorie';
        submitButton.textContent = 'Mettre à jour';

        document.getElementById('categoryId').value = String(category.id);
        document.getElementById('categoryName').value = category.name || '';
        document.getElementById('categoryDescription').value = category.description || '';

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

        const categoryId = document.getElementById('categoryId').value;
        const payload = {
            name: document.getElementById('categoryName').value.trim(),
            description: document.getElementById('categoryDescription').value.trim(),
        };

        const isEditing = Boolean(categoryId);
        const url = isEditing ? `${CATEGORIES_URL}${categoryId}/` : CATEGORIES_URL;

        setButtonLoading(submitButton, true, 'Enregistrement...');

        try {
            await api(url, {
                method: isEditing ? 'PATCH' : 'POST',
                body: payload,
            });

            closeModal(modal);
            toast(
                isEditing
                    ? 'La catégorie a été mise à jour.'
                    : 'La catégorie a été ajoutée.',
                'success'
            );

            await loadData();
        } catch (error) {
            showFormErrors(form, error);
            handleError(error, 'Impossible d’enregistrer la catégorie.');
        } finally {
            setButtonLoading(submitButton, false);
        }
    }

    async function deleteCategory(categoryId) {
        const category = categories.find(
            (item) => Number(item.id) === Number(categoryId)
        );

        if (!category) {
            return;
        }

        if (Number(category.medicines_count || 0) > 0) {
            toast(
                'Cette catégorie contient des médicaments et ne peut pas être supprimée.',
                'warning'
            );
            return;
        }

        const confirmed = await confirmDialog({
            title: 'Supprimer la catégorie',
            message: `Supprimer la catégorie « ${category.name} » ?`,
            confirmText: 'Supprimer',
            danger: true,
        });

        if (!confirmed) {
            return;
        }

        try {
            await api(`${CATEGORIES_URL}${category.id}/`, {
                method: 'DELETE',
            });

            toast('La catégorie a été supprimée.', 'success');
            await loadData();
        } catch (error) {
            handleError(error, 'Impossible de supprimer la catégorie.');
        }
    }

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');

            if (!button || button.disabled) {
                return;
            }

            const categoryId = button.dataset.id;

            if (button.dataset.action === 'edit') {
                openEditModal(categoryId);
            } else if (button.dataset.action === 'delete') {
                deleteCategory(categoryId);
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => applyFilters(true), 250));
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            searchInput.value = '';
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

/* Gestion des pages HTML d'alertes de stock (faible / expiré). */
(function () {
    'use strict';

    const {
        api,
        toast,
        formatDate,
        escapeHtml,
        debounce,
        renderPagination,
        emptyState,
    } = window.PharmaStock;

    const PAGE_SIZE = 10;

    const page = document.getElementById('inventoryAlertPage');

    if (!page) {
        return;
    }

    const endpoint = page.dataset.endpoint;
    const kind = page.dataset.kind;

    const pageError = document.getElementById('inventoryAlertPageError');
    const searchInput = document.getElementById('inventoryAlertSearch');
    const resetButton = document.getElementById('resetInventoryAlertFilters');
    const resultCount = document.getElementById('inventoryAlertResultCount');
    const tableBody = document.getElementById('inventoryAlertTableBody');
    const pagination = document.getElementById('inventoryAlertPagination');
    const countElement = document.getElementById('inventoryAlertCount');

    let batches = [];
    let filteredBatches = [];
    let currentPage = 1;

    function showPageError(message) {
        if (!pageError) {
            return;
        }

        pageError.textContent = message;
        pageError.classList.remove('hidden');
    }

    function hidePageError() {
        if (!pageError) {
            return;
        }

        pageError.textContent = '';
        pageError.classList.add('hidden');
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

    function today() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function isExpired(batch) {
        const parts = String(batch.expiry_date || '').split('-').map(Number);

        if (parts.length !== 3 || parts.some(Number.isNaN)) {
            return false;
        }

        return new Date(parts[0], parts[1] - 1, parts[2]) < today();
    }

    async function loadData() {
        hidePageError();

        try {
            const data = await api(endpoint);
            batches = asArray(data);
            applyFilters(false);
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les lots.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les lots.');
        }
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();

        filteredBatches = batches.filter((batch) => (
            !search
            || (batch.medicine_name || '').toLowerCase().includes(search)
            || (batch.batch_number || '').toLowerCase().includes(search)
        ));

        filteredBatches.sort((first, second) => {
            const firstExpiry = new Date(`${first.expiry_date}T00:00:00`);
            const secondExpiry = new Date(`${second.expiry_date}T00:00:00`);

            if (!Number.isNaN(firstExpiry.getTime()) && !Number.isNaN(secondExpiry.getTime())) {
                return firstExpiry - secondExpiry;
            }

            return String(first.batch_number).localeCompare(
                String(second.batch_number),
                'fr',
                { sensitivity: 'base' }
            );
        });

        if (resetPage) {
            currentPage = 1;
        }

        countElement.textContent = String(batches.length);
        renderTable();
        renderFilterCount();
    }

    function renderFilterCount() {
        if (!resultCount) {
            return;
        }

        resultCount.textContent = `${filteredBatches.length} lot(s)`;
    }

    function statusBadge(batch) {
        if (isExpired(batch)) {
            return '<span class="badge badge-danger">Expiré</span>';
        }

        if (Number(batch.quantity_available || 0) === 0) {
            return '<span class="badge badge-danger">Rupture</span>';
        }

        return '<span class="badge badge-warning">Stock faible</span>';
    }

    function renderTable() {
        const pages = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE));

        if (currentPage > pages) {
            currentPage = pages;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredBatches.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        ${emptyState(
                            kind === 'expired'
                                ? 'Aucun lot expiré avec du stock restant.'
                                : 'Aucun lot en stock faible.',
                            kind === 'expired' ? 'Aucun lot expiré' : 'Aucun stock faible'
                        )}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageItems.map((batch) => `
                <tr>
                    <td>
                        <span class="cell-main">${escapeHtml(batch.medicine_name || '—')}</span>
                    </td>
                    <td>${escapeHtml(batch.batch_number || '—')}</td>
                    <td class="text-right">${Number(batch.quantity_available || 0)}</td>
                    <td class="text-right">${Number(batch.quantity_received || 0)}</td>
                    <td>${formatDate(batch.expiry_date)}</td>
                    <td>${statusBadge(batch)}</td>
                    <td class="text-right">
                        <div class="table-actions">
                            <a
                                class="btn btn-icon"
                                href="/inventory/movements/?batch=${batch.id}"
                                title="Enregistrer un mouvement"
                                aria-label="Enregistrer un mouvement pour le lot ${escapeHtml(batch.batch_number)}"
                            >↕</a>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        renderPagination(pagination, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            total: filteredBatches.length,
            onChange: (newPage) => {
                currentPage = newPage;
                renderTable();
            },
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

    loadData();
})();

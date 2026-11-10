/* Gestion de la page HTML des lots de stock. */
(function () {
    'use strict';

    const {
        api,
        toast,
        formatMoney,
        formatDate,
        escapeHtml,
        debounce,
        renderPagination,
        emptyState,
    } = window.PharmaStock;

    const BATCHES_URL = '/api/inventory/batches/';
    const LOW_STOCK_URL = '/api/inventory/batches/low_stock/';
    const EXPIRED_URL = '/api/inventory/batches/expired/';
    const PAGE_SIZE = 10;

    const page = document.getElementById('inventoryPage');

    if (!page) {
        return;
    }

    const pageAlert = document.getElementById('inventoryPageAlert');
    const searchInput = document.getElementById('batchSearch');
    const medicineFilter = document.getElementById('batchMedicineFilter');
    const statusFilter = document.getElementById('batchStatusFilter');
    const resetButton = document.getElementById('resetBatchFilters');
    const resultCount = document.getElementById('batchResultCount');
    const tableBody = document.getElementById('batchTableBody');
    const pagination = document.getElementById('batchPagination');
    const batchCount = document.getElementById('inventoryBatchCount');
    const availableCount = document.getElementById('inventoryAvailableCount');
    const lowCount = document.getElementById('inventoryLowCount');
    const expiredCount = document.getElementById('inventoryExpiredCount');

    let batches = [];
    let lowStockBatches = [];
    let expiredBatches = [];
    let filteredBatches = [];
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

    function parseDateOnly(value) {
        if (!value) {
            return null;
        }

        const parts = String(value).split('-').map(Number);

        if (parts.length !== 3 || parts.some(Number.isNaN)) {
            return null;
        }

        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function daysUntilExpiry(batch) {
        const expiry = parseDateOnly(batch.expiry_date);

        if (!expiry) {
            return null;
        }

        return Math.ceil((expiry.getTime() - today().getTime()) / 86400000);
    }

    function isExpired(batch) {
        const days = daysUntilExpiry(batch);
        return days !== null && days < 0;
    }

    function isExpiringSoon(batch) {
        const days = daysUntilExpiry(batch);
        return days !== null && days >= 0 && days <= 30;
    }

    function isLowStock(batch) {
        return Number(batch.quantity_available) <= 10;
    }

    async function loadData() {
        hidePageError();

        try {
            const [batchesData, lowData, expiredData] = await Promise.all([
                api(BATCHES_URL),
                api(LOW_STOCK_URL),
                api(EXPIRED_URL),
            ]);

            batches = asArray(batchesData);
            lowStockBatches = asArray(lowData);
            expiredBatches = asArray(expiredData);

            populateMedicineFilter();
            applyFilters(false);
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les lots de stock.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les lots de stock.');
        }
    }

    function populateMedicineFilter() {
        if (!medicineFilter) {
            return;
        }

        const previousValue = medicineFilter.value;
        const medicines = new Map();

        batches.forEach((batch) => {
            if (!medicines.has(String(batch.medicine))) {
                medicines.set(String(batch.medicine), batch.medicine_name);
            }
        });

        const sortedMedicines = Array.from(medicines.entries()).sort(
            (first, second) => first[1].localeCompare(second[1], 'fr', {
                sensitivity: 'base',
            })
        );

        medicineFilter.innerHTML = '<option value="">Tous les médicaments</option>';

        sortedMedicines.forEach(([id, name]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            medicineFilter.appendChild(option);
        });

        if (
            previousValue
            && sortedMedicines.some(([id]) => id === previousValue)
        ) {
            medicineFilter.value = previousValue;
        }
    }

    function renderStats() {
        batchCount.textContent = String(batches.length);
        availableCount.textContent = String(
            batches.reduce(
                (total, batch) => total + Number(batch.quantity_available || 0),
                0
            )
        );
        lowCount.textContent = String(lowStockBatches.length);
        expiredCount.textContent = String(expiredBatches.length);
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();
        const medicine = medicineFilter.value;
        const status = statusFilter.value;

        filteredBatches = batches.filter((batch) => {
            const matchesSearch = !search
                || (batch.medicine_name || '').toLowerCase().includes(search)
                || (batch.batch_number || '').toLowerCase().includes(search);

            const matchesMedicine = !medicine
                || String(batch.medicine) === medicine;

            let matchesStatus = true;

            if (status === 'available') {
                matchesStatus = Number(batch.quantity_available) > 0 && !isExpired(batch);
            } else if (status === 'low') {
                matchesStatus = isLowStock(batch);
            } else if (status === 'expired') {
                matchesStatus = isExpired(batch);
            } else if (status === 'expiring') {
                matchesStatus = isExpiringSoon(batch) && !isExpired(batch);
            }

            return matchesSearch && matchesMedicine && matchesStatus;
        });

        filteredBatches.sort((first, second) => {
            const firstExpiry = parseDateOnly(first.expiry_date);
            const secondExpiry = parseDateOnly(second.expiry_date);

            if (firstExpiry && secondExpiry) {
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

        renderStats();
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
        const available = Number(batch.quantity_available || 0);

        if (isExpired(batch)) {
            return '<span class="badge badge-danger">Expiré</span>';
        }

        if (available === 0) {
            return '<span class="badge badge-danger">Rupture</span>';
        }

        if (isLowStock(batch)) {
            return '<span class="badge badge-warning">Stock faible</span>';
        }

        if (isExpiringSoon(batch)) {
            return '<span class="badge badge-warning">Expire bientôt</span>';
        }

        return '<span class="badge badge-success">Disponible</span>';
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
                    <td colspan="9">
                        ${emptyState(
                            'Aucun lot ne correspond à votre recherche.',
                            'Aucun lot de stock'
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
                    <td>
                        <span class="cell-main">${escapeHtml(batch.batch_number || '—')}</span>
                    </td>
                    <td class="text-right">${Number(batch.quantity_received || 0)}</td>
                    <td class="text-right">${Number(batch.quantity_available || 0)}</td>
                    <td class="money">${formatMoney(batch.purchase_price)}</td>
                    <td>${formatDate(batch.manufacturing_date)}</td>
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

    if (medicineFilter) {
        medicineFilter.addEventListener('change', () => applyFilters(true));
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => applyFilters(true));
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            searchInput.value = '';
            medicineFilter.value = '';
            statusFilter.value = '';
            applyFilters(true);
        });
    }

    loadData();
})();

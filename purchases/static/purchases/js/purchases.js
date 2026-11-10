/* Gestion de la page HTML de la liste des achats. */
(function () {
    'use strict';

    const {
        api,
        toast,
        formatMoney,
        formatDate,
        formatDateTime,
        escapeHtml,
        debounce,
        renderPagination,
        emptyState,
    } = window.PharmaStock;

    const PURCHASES_URL = '/api/purchases/purchases/';
    const PAGE_SIZE = 10;

    const page = document.getElementById('purchasesPage');

    if (!page) {
        return;
    }

    const pageAlert = document.getElementById('purchasesPageAlert');
    const searchInput = document.getElementById('purchaseSearch');
    const statusFilter = document.getElementById('purchaseStatusFilter');
    const resetButton = document.getElementById('resetPurchaseFilters');
    const resultCount = document.getElementById('purchaseResultCount');
    const tableBody = document.getElementById('purchaseTableBody');
    const pagination = document.getElementById('purchasePagination');
    const totalCount = document.getElementById('purchasesTotalCount');
    const pendingCount = document.getElementById('purchasesPendingCount');
    const partialCount = document.getElementById('purchasesPartialCount');
    const receivedCount = document.getElementById('purchasesReceivedCount');

    let purchases = [];
    let filteredPurchases = [];
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

    async function loadData() {
        hidePageError();

        try {
            const data = await api(PURCHASES_URL);
            purchases = asArray(data);
            applyFilters(false);
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les achats.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les achats.');
        }
    }

    function renderStats() {
        totalCount.textContent = String(purchases.length);
        pendingCount.textContent = String(
            purchases.filter((purchase) => purchase.status === 'PENDING').length
        );
        partialCount.textContent = String(
            purchases.filter((purchase) => purchase.status === 'PARTIAL').length
        );
        receivedCount.textContent = String(
            purchases.filter((purchase) => purchase.status === 'RECEIVED').length
        );
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();
        const status = statusFilter.value;

        filteredPurchases = purchases.filter((purchase) => {
            const items = Array.isArray(purchase.items) ? purchase.items : [];
            const matchesSearch = !search
                || String(purchase.id).includes(search)
                || (purchase.supplier_name || '').toLowerCase().includes(search)
                || (purchase.ordered_by_username || '').toLowerCase().includes(search)
                || items.some((item) => (
                    (item.medicine_name || '').toLowerCase().includes(search)
                ));
            const matchesStatus = !status || purchase.status === status;

            return matchesSearch && matchesStatus;
        });

        filteredPurchases.sort((first, second) => (
            new Date(second.order_date) - new Date(first.order_date)
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

        resultCount.textContent = `${filteredPurchases.length} achat(s)`;
    }

    function statusBadge(status) {
        const labels = {
            PENDING: ['badge-warning', 'En attente'],
            PARTIAL: ['badge-info', 'Partiel'],
            RECEIVED: ['badge-success', 'Reçu'],
            CANCELLED: ['badge-danger', 'Annulé'],
        };
        const [className, label] = labels[status] || ['badge-neutral', status || '—'];

        return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
    }

    function renderTable() {
        const pages = Math.max(1, Math.ceil(filteredPurchases.length / PAGE_SIZE));

        if (currentPage > pages) {
            currentPage = pages;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredPurchases.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        ${emptyState(
                            'Aucun achat ne correspond à votre recherche.',
                            'Aucun achat'
                        )}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageItems.map((purchase) => {
                const items = Array.isArray(purchase.items) ? purchase.items : [];
                const totalQuantity = items.reduce(
                    (total, item) => total + Number(item.quantity_ordered || 0),
                    0
                );

                return `
                    <tr>
                        <td>
                            <span class="cell-main">Achat #${purchase.id}</span>
                        </td>
                        <td class="nowrap">${formatDateTime(purchase.order_date)}</td>
                        <td>${escapeHtml(purchase.supplier_name || '—')}</td>
                        <td>
                            <span class="cell-main">${items.length} ligne(s)</span>
                            <span class="cell-sub">${totalQuantity} unité(s)</span>
                        </td>
                        <td class="money">${formatMoney(purchase.total_amount)}</td>
                        <td>${statusBadge(purchase.status)}</td>
                        <td>${formatDate(purchase.expected_date)}</td>
                        <td class="text-right">
                            <div class="table-actions">
                                <a
                                    class="btn btn-icon"
                                    href="/purchases/${purchase.id}/"
                                    title="Voir le détail"
                                    aria-label="Voir le détail de l’achat ${purchase.id}"
                                >👁</a>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        renderPagination(pagination, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            total: filteredPurchases.length,
            onChange: (newPage) => {
                currentPage = newPage;
                renderTable();
            },
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

    loadData();
})();

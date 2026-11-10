/* Gestion de la page HTML de l'historique des ventes. */
(function () {
    'use strict';

    const {
        api,
        toast,
        formatMoney,
        formatDateTime,
        escapeHtml,
        debounce,
        renderPagination,
        emptyState,
    } = window.PharmaStock;

    const SALES_URL = '/api/sales/';
    const PAGE_SIZE = 10;

    const page = document.getElementById('salesPage');

    if (!page) {
        return;
    }

    const pageAlert = document.getElementById('salesPageAlert');
    const searchInput = document.getElementById('salesSearch');
    const statusFilter = document.getElementById('salesStatusFilter');
    const resetButton = document.getElementById('resetSalesFilters');
    const resultCount = document.getElementById('salesResultCount');
    const tableBody = document.getElementById('salesTableBody');
    const pagination = document.getElementById('salesPagination');
    const totalCount = document.getElementById('salesTotalCount');
    const completedCount = document.getElementById('salesCompletedCount');
    const cancelledCount = document.getElementById('salesCancelledCount');
    const revenueTotal = document.getElementById('salesRevenueTotal');

    let sales = [];
    let filteredSales = [];
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
            const data = await api(SALES_URL);
            sales = asArray(data);
            applyFilters(false);
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les ventes.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les ventes.');
        }
    }

    function renderStats() {
        const completedSales = sales.filter((sale) => sale.status === 'COMPLETED');

        totalCount.textContent = String(sales.length);
        completedCount.textContent = String(completedSales.length);
        cancelledCount.textContent = String(
            sales.filter((sale) => sale.status === 'CANCELLED').length
        );
        revenueTotal.textContent = formatMoney(
            completedSales.reduce(
                (total, sale) => total + Number(sale.total_amount || 0),
                0
            )
        );
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();
        const status = statusFilter.value;

        filteredSales = sales.filter((sale) => {
            const items = Array.isArray(sale.items) ? sale.items : [];
            const matchesSearch = !search
                || String(sale.id).includes(search)
                || (sale.sold_by_username || '').toLowerCase().includes(search)
                || items.some((item) => (
                    (item.medicine_name || '').toLowerCase().includes(search)
                    || (item.batch_number || '').toLowerCase().includes(search)
                ));

            const matchesStatus = !status || sale.status === status;

            return matchesSearch && matchesStatus;
        });

        filteredSales.sort((first, second) => (
            new Date(second.sale_date) - new Date(first.sale_date)
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

        resultCount.textContent = `${filteredSales.length} vente(s)`;
    }

    function statusBadge(status) {
        if (status === 'COMPLETED') {
            return '<span class="badge badge-success">Terminée</span>';
        }

        if (status === 'CANCELLED') {
            return '<span class="badge badge-danger">Annulée</span>';
        }

        return `<span class="badge badge-neutral">${escapeHtml(status || '—')}</span>`;
    }

    function renderTable() {
        const pages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));

        if (currentPage > pages) {
            currentPage = pages;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredSales.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        ${emptyState(
                            'Aucune vente ne correspond à votre recherche.',
                            'Aucune vente'
                        )}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageItems.map((sale) => {
                const items = Array.isArray(sale.items) ? sale.items : [];
                const totalQuantity = items.reduce(
                    (total, item) => total + Number(item.quantity || 0),
                    0
                );

                return `
                    <tr>
                        <td>
                            <span class="cell-main">Vente #${sale.id}</span>
                        </td>
                        <td class="nowrap">${formatDateTime(sale.sale_date)}</td>
                        <td>${escapeHtml(sale.sold_by_username || '—')}</td>
                        <td>
                            <span class="cell-main">${items.length} ligne(s)</span>
                            <span class="cell-sub">${totalQuantity} article(s)</span>
                        </td>
                        <td class="money">${formatMoney(sale.total_amount)}</td>
                        <td>${statusBadge(sale.status)}</td>
                        <td class="text-right">
                            <div class="table-actions">
                                <a
                                    class="btn btn-icon"
                                    href="/sales/${sale.id}/"
                                    title="Voir le détail"
                                    aria-label="Voir le détail de la vente ${sale.id}"
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
            total: filteredSales.length,
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

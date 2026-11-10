/* Gestion de la page HTML de l'historique des réceptions d'achat. */
(function () {
    'use strict';

    const {
        api,
        toast,
        formatDate,
        formatDateTime,
        escapeHtml,
        debounce,
        renderPagination,
        emptyState,
    } = window.PharmaStock;

    const RECEIPTS_URL = '/api/purchases/receipts/';
    const PAGE_SIZE = 10;

    const page = document.getElementById('purchaseReceiptsPage');

    if (!page) {
        return;
    }

    const pageAlert = document.getElementById('purchaseReceiptsPageAlert');
    const searchInput = document.getElementById('receiptSearch');
    const statusFilter = document.getElementById('receiptStatusFilter');
    const resetButton = document.getElementById('resetReceiptFilters');
    const resultCount = document.getElementById('receiptResultCount');
    const tableBody = document.getElementById('receiptTableBody');
    const pagination = document.getElementById('receiptPagination');
    const totalCount = document.getElementById('receiptsTotalCount');
    const confirmedCount = document.getElementById('receiptsConfirmedCount');
    const quantityTotal = document.getElementById('receiptsQuantityTotal');

    let receipts = [];
    let filteredReceipts = [];
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
            const data = await api(RECEIPTS_URL);
            receipts = asArray(data);
            applyFilters(false);
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les réceptions.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les réceptions.');
        }
    }

    function renderStats() {
        const confirmed = receipts.filter(
            (receipt) => receipt.status === 'CONFIRMED'
        );

        totalCount.textContent = String(receipts.length);
        confirmedCount.textContent = String(confirmed.length);
        quantityTotal.textContent = String(
            confirmed.reduce(
                (total, receipt) => total + Number(receipt.quantity || 0),
                0
            )
        );
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();
        const status = statusFilter.value;

        filteredReceipts = receipts.filter((receipt) => {
            const matchesSearch = !search
                || String(receipt.purchase_id).includes(search)
                || (receipt.medicine_name || '').toLowerCase().includes(search)
                || (receipt.batch_number || '').toLowerCase().includes(search)
                || (receipt.received_by_username || '').toLowerCase().includes(search);
            const matchesStatus = !status || receipt.status === status;

            return matchesSearch && matchesStatus;
        });

        filteredReceipts.sort((first, second) => (
            new Date(second.receipt_date) - new Date(first.receipt_date)
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

        resultCount.textContent = `${filteredReceipts.length} réception(s)`;
    }

    function statusBadge(status) {
        const labels = {
            CONFIRMED: ['badge-success', 'Confirmée'],
            DRAFT: ['badge-warning', 'Brouillon'],
            CANCELLED: ['badge-danger', 'Annulée'],
        };
        const [className, label] = labels[status] || ['badge-neutral', status || '—'];

        return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
    }

    function renderTable() {
        const pages = Math.max(1, Math.ceil(filteredReceipts.length / PAGE_SIZE));

        if (currentPage > pages) {
            currentPage = pages;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredReceipts.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9">
                        ${emptyState(
                            'Aucune réception ne correspond à votre recherche.',
                            'Aucune réception'
                        )}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageItems.map((receipt) => `
                <tr>
                    <td class="nowrap">${formatDateTime(receipt.receipt_date)}</td>
                    <td>
                        <a href="/purchases/${receipt.purchase_id}/" class="cell-main">
                            Achat #${receipt.purchase_id}
                        </a>
                    </td>
                    <td>${escapeHtml(receipt.medicine_name || '—')}</td>
                    <td class="text-right">${Number(receipt.quantity || 0)}</td>
                    <td>${escapeHtml(receipt.batch_number || '—')}</td>
                    <td>${formatDate(receipt.expiry_date)}</td>
                    <td>${escapeHtml(receipt.received_by_username || '—')}</td>
                    <td>${statusBadge(receipt.status)}</td>
                    <td class="text-right">
                        <div class="table-actions">
                            <a
                                class="btn btn-icon"
                                href="/purchases/${receipt.purchase_id}/"
                                title="Voir l’achat"
                                aria-label="Voir l’achat ${receipt.purchase_id}"
                            >👁</a>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        renderPagination(pagination, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            total: filteredReceipts.length,
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

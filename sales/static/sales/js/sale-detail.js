/* Gestion de la page HTML de détail d'une vente. */
(function () {
    'use strict';

    const {
        api,
        toast,
        formatMoney,
        formatDateTime,
        escapeHtml,
    } = window.PharmaStock;

    const page = document.getElementById('saleDetailPage');

    if (!page) {
        return;
    }

    const saleId = page.dataset.saleId;
    const pageError = document.getElementById('saleDetailError');
    const subtitle = document.getElementById('saleDetailSubtitle');
    const totalElement = document.getElementById('saleDetailTotal');
    const itemCountElement = document.getElementById('saleDetailItemCount');
    const statusValue = document.getElementById('saleDetailStatusValue');
    const sellerElement = document.getElementById('saleDetailSeller');
    const dateElement = document.getElementById('saleDetailDate');
    const statusElement = document.getElementById('saleDetailStatus');
    const totalSecondary = document.getElementById('saleDetailTotalSecondary');
    const itemCountSecondary = document.getElementById('saleDetailItemCountSecondary');
    const itemsBody = document.getElementById('saleDetailItemsBody');

    function showPageError(message) {
        if (!pageError) {
            return;
        }

        pageError.textContent = message;
        pageError.classList.remove('hidden');
    }

    function redirectToLogin() {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/api/dashboard/login/?next=${next}`;
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

    function renderSale(sale) {
        const items = Array.isArray(sale.items) ? sale.items : [];
        const totalQuantity = items.reduce(
            (total, item) => total + Number(item.quantity || 0),
            0
        );

        subtitle.textContent = `Vente enregistrée le ${formatDateTime(sale.sale_date)} par ${sale.sold_by_username || '—'}.`;
        totalElement.textContent = formatMoney(sale.total_amount);
        itemCountElement.textContent = String(items.length);
        statusValue.innerHTML = statusBadge(sale.status);
        sellerElement.textContent = sale.sold_by_username || '—';
        dateElement.textContent = formatDateTime(sale.sale_date);
        statusElement.innerHTML = statusBadge(sale.status);
        totalSecondary.textContent = formatMoney(sale.total_amount);
        itemCountSecondary.textContent = `${items.length} ligne(s) · ${totalQuantity} article(s)`;

        if (items.length === 0) {
            itemsBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <h3>Aucune ligne de vente</h3>
                            <p>Cette vente ne contient aucun médicament.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        itemsBody.innerHTML = items.map((item) => `
            <tr>
                <td>
                    <span class="cell-main">${escapeHtml(item.medicine_name || '—')}</span>
                </td>
                <td>${escapeHtml(item.batch_number || '—')}</td>
                <td class="text-right">${Number(item.quantity || 0)}</td>
                <td class="text-right money">${formatMoney(item.unit_price)}</td>
                <td class="text-right money">${formatMoney(item.subtotal)}</td>
            </tr>
        `).join('');
    }

    async function loadSale() {
        try {
            const sale = await api(`/api/sales/${saleId}/`);
            renderSale(sale);

            if (new URLSearchParams(window.location.search).get('created') === '1') {
                toast('La vente a été enregistrée avec succès.', 'success');
            }
        } catch (error) {
            if (error.status === 401) {
                toast('Votre session a expiré. Veuillez vous reconnecter.', 'error');
                redirectToLogin();
                return;
            }

            showPageError(
                error.status === 404
                    ? 'Cette vente est introuvable ou ne vous est pas accessible.'
                    : (error.message || 'Impossible de charger la vente.')
            );
            itemsBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <h3>Chargement impossible</h3>
                            <p>Revenez à la liste des ventes et réessayez.</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    loadSale();
})();

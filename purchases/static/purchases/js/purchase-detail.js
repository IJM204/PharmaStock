/* Gestion de la page HTML de détail et réception d'un achat. */
(function () {
    'use strict';

    const {
        api,
        toast,
        openModal,
        closeModal,
        formatMoney,
        formatDate,
        formatDateTime,
        escapeHtml,
        clearFormErrors,
        showFormErrors,
        setButtonLoading,
        emptyState,
    } = window.PharmaStock;

    const page = document.getElementById('purchaseDetailPage');

    if (!page) {
        return;
    }

    const purchaseId = page.dataset.purchaseId;
    const pageError = document.getElementById('purchaseDetailError');
    const subtitle = document.getElementById('purchaseDetailSubtitle');
    const totalElement = document.getElementById('purchaseDetailTotal');
    const orderedElement = document.getElementById('purchaseDetailOrdered');
    const receivedElement = document.getElementById('purchaseDetailReceived');
    const remainingElement = document.getElementById('purchaseDetailRemaining');
    const supplierElement = document.getElementById('purchaseDetailSupplier');
    const orderedByElement = document.getElementById('purchaseDetailOrderedBy');
    const orderDateElement = document.getElementById('purchaseDetailOrderDate');
    const expectedDateElement = document.getElementById('purchaseDetailExpectedDate');
    const statusElement = document.getElementById('purchaseDetailStatus');
    const notesElement = document.getElementById('purchaseDetailNotes');
    const itemsBody = document.getElementById('purchaseItemsBody');
    const receiptsBody = document.getElementById('purchaseReceiptsBody');
    const receiveButton = document.getElementById('receivePurchaseButton');

    const modal = document.getElementById('receivePurchaseModal');
    const form = document.getElementById('receivePurchaseForm');
    const submitButton = document.getElementById('receiveSubmitButton');
    const itemSelect = document.getElementById('receivePurchaseItem');
    const itemHelp = document.getElementById('receivePurchaseItemHelp');
    const quantityInput = document.getElementById('receiveQuantity');
    const batchNumberInput = document.getElementById('receiveBatchNumber');
    const manufacturingInput = document.getElementById('receiveManufacturingDate');
    const expiryInput = document.getElementById('receiveExpiryDate');
    const notesInput = document.getElementById('receiveNotes');
    const itemSummary = document.getElementById('receiveItemSummary');

    let purchase = null;

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

    function receiptStatusBadge(status) {
        const labels = {
            CONFIRMED: ['badge-success', 'Confirmée'],
            DRAFT: ['badge-warning', 'Brouillon'],
            CANCELLED: ['badge-danger', 'Annulée'],
        };
        const [className, label] = labels[status] || ['badge-neutral', status || '—'];

        return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
    }

    function calculateTotals() {
        const items = Array.isArray(purchase.items) ? purchase.items : [];
        const ordered = items.reduce(
            (total, item) => total + Number(item.quantity_ordered || 0),
            0
        );
        const received = items.reduce(
            (total, item) => total + Number(item.quantity_received || 0),
            0
        );

        return {
            ordered,
            received,
            remaining: Math.max(0, ordered - received),
        };
    }

    function renderPurchase() {
        const items = Array.isArray(purchase.items) ? purchase.items : [];
        const totals = calculateTotals();

        subtitle.textContent = `Commande du ${formatDateTime(purchase.order_date)} · ${purchase.supplier_name || '—'}`;
        totalElement.textContent = formatMoney(purchase.total_amount);
        orderedElement.textContent = String(totals.ordered);
        receivedElement.textContent = String(totals.received);
        remainingElement.textContent = String(totals.remaining);
        supplierElement.textContent = purchase.supplier_name || '—';
        orderedByElement.textContent = purchase.ordered_by_username || '—';
        orderDateElement.textContent = formatDateTime(purchase.order_date);
        expectedDateElement.textContent = formatDate(purchase.expected_date);
        statusElement.innerHTML = statusBadge(purchase.status);
        notesElement.textContent = purchase.notes || '—';

        const canReceive = (
            purchase.status !== 'CANCELLED'
            && totals.remaining > 0
        );
        receiveButton.disabled = !canReceive;

        if (items.length === 0) {
            itemsBody.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="empty-state">
                            <h3>Aucune ligne d’achat</h3>
                            <p>Cet achat ne contient aucun médicament.</p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            itemsBody.innerHTML = items.map((item) => {
                const remaining = Math.max(
                    0,
                    Number(item.quantity_ordered || 0)
                        - Number(item.quantity_received || 0)
                );
                let action = '<span class="badge badge-success">Complet</span>';

                if (purchase.status === 'CANCELLED') {
                    action = '—';
                } else if (remaining > 0) {
                    action = `
                        <button
                            type="button"
                            class="btn btn-secondary btn-sm"
                            data-receive-item="${item.id}"
                        >
                            Réceptionner
                        </button>
                    `;
                }

                return `
                    <tr>
                        <td>
                            <span class="cell-main">${escapeHtml(item.medicine_name || '—')}</span>
                        </td>
                        <td class="text-right">${Number(item.quantity_ordered || 0)}</td>
                        <td class="text-right">${Number(item.quantity_received || 0)}</td>
                        <td class="text-right">${remaining}</td>
                        <td class="text-right money">${formatMoney(item.unit_price)}</td>
                        <td>${formatDate(item.manufacturing_date)}</td>
                        <td>${formatDate(item.expiry_date)}</td>
                        <td class="text-right money">${formatMoney(item.subtotal)}</td>
                        <td class="text-right">${action}</td>
                    </tr>
                `;
            }).join('');
        }

        populateReceiveItems();
    }

    function populateReceiveItems() {
        if (!purchase || !itemSelect) {
            return;
        }

        const previousValue = itemSelect.value;
        const items = (Array.isArray(purchase.items) ? purchase.items : [])
            .filter((item) => (
                Number(item.quantity_ordered) > Number(item.quantity_received)
            ))
            .sort((first, second) => (
                String(first.medicine_name).localeCompare(
                    String(second.medicine_name),
                    'fr',
                    { sensitivity: 'base' }
                )
            ));

        itemSelect.innerHTML = '';

        if (items.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Aucune ligne à réceptionner';
            itemSelect.appendChild(option);
            itemSelect.disabled = true;
            quantityInput.disabled = true;
            batchNumberInput.disabled = true;
            submitButton.disabled = true;
            itemHelp.textContent = 'Toutes les lignes sont déjà réceptionnées.';
            updateSelectedItem();
            return;
        }

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Sélectionner une ligne';
        itemSelect.appendChild(placeholder);

        items.forEach((item) => {
            const remaining = Number(item.quantity_ordered) - Number(item.quantity_received);
            const option = document.createElement('option');
            option.value = String(item.id);
            option.textContent = `${item.medicine_name} — restant : ${remaining} / commandé : ${item.quantity_ordered}`;
            itemSelect.appendChild(option);
        });

        itemSelect.disabled = false;
        quantityInput.disabled = false;
        batchNumberInput.disabled = false;
        submitButton.disabled = false;

        if (
            previousValue
            && items.some((item) => String(item.id) === previousValue)
        ) {
            itemSelect.value = previousValue;
        }

        itemHelp.textContent = 'Seules les lignes avec une quantité restante sont proposées.';
        updateSelectedItem();
    }

    function selectedItem() {
        if (!purchase || !itemSelect || !itemSelect.value) {
            return null;
        }

        return (purchase.items || []).find(
            (item) => String(item.id) === itemSelect.value
        ) || null;
    }

    function updateSelectedItem() {
        const item = selectedItem();

        if (!item) {
            itemSummary.textContent = 'Sélectionnez une ligne pour afficher la quantité restante.';
            itemSummary.className = 'alert alert-info';
            quantityInput.value = '';
            quantityInput.removeAttribute('max');
            manufacturingInput.value = '';
            expiryInput.value = '';
            submitButton.disabled = true;
            return;
        }

        const remaining = Math.max(
            0,
            Number(item.quantity_ordered) - Number(item.quantity_received)
        );

        itemSummary.textContent = `Médicament : ${item.medicine_name} · commandé : ${item.quantity_ordered} · reçu : ${item.quantity_received} · restant : ${remaining}`;
        itemSummary.className = 'alert alert-info';
        quantityInput.max = String(remaining);
        quantityInput.value = String(remaining);
        manufacturingInput.value = item.manufacturing_date || '';
        expiryInput.value = item.expiry_date || '';
        submitButton.disabled = false;
    }

    function renderReceipts(receipts) {
        if (!receiptsBody) {
            return;
        }

        if (receipts.length === 0) {
            receiptsBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        ${emptyState(
                            'Aucune réception n’a encore été enregistrée pour cet achat.',
                            'Aucune réception'
                        )}
                    </td>
                </tr>
            `;
            return;
        }

        receiptsBody.innerHTML = receipts.map((receipt) => `
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
                <td>${receiptStatusBadge(receipt.status)}</td>
            </tr>
        `).join('');
    }

    async function loadAll(showCreatedToast = false) {
        hidePageError();

        try {
            const [purchaseData, receiptsData] = await Promise.all([
                api(`/api/purchases/purchases/${purchaseId}/`),
                api(`/api/purchases/receipts/?purchase=${purchaseId}`),
            ]);

            purchase = purchaseData;
            renderPurchase();
            renderReceipts(asArray(receiptsData));

            if (showCreatedToast) {
                toast('L’achat a été créé avec succès.', 'success');
            }
        } catch (error) {
            if (error.status === 401) {
                handleError(error);
                return;
            }

            const message = error.status === 404
                ? 'Cet achat est introuvable.'
                : (error.message || 'Impossible de charger l’achat.');

            showPageError(message);
            itemsBody.innerHTML = `
                <tr>
                    <td colspan="9">${emptyState(message, 'Chargement impossible')}</td>
                </tr>
            `;
            receiptsBody.innerHTML = `
                <tr>
                    <td colspan="8">${emptyState(message, 'Chargement impossible')}</td>
                </tr>
            `;
        }
    }

    function showModalError(message) {
        if (!form) {
            return;
        }

        clearFormErrors(form);
        const summary = form.querySelector('[data-form-error]');

        if (summary) {
            summary.textContent = message;
            summary.classList.remove('hidden');
        }
    }

    function openReceiveModal(itemId = '') {
        if (!purchase) {
            return;
        }

        const availableItems = (purchase.items || []).filter(
            (item) => Number(item.quantity_ordered) > Number(item.quantity_received)
        );

        if (availableItems.length === 0) {
            toast('Toutes les lignes de cet achat sont déjà réceptionnées.', 'info');
            return;
        }

        form.reset();
        clearFormErrors(form);
        populateReceiveItems();

        if (itemId) {
            const exists = availableItems.some(
                (item) => String(item.id) === String(itemId)
            );

            if (exists) {
                itemSelect.value = String(itemId);
            }
        } else if (availableItems.length === 1) {
            itemSelect.value = String(availableItems[0].id);
        }

        updateSelectedItem();
        openModal(modal);
    }

    async function submitReceive(event) {
        event.preventDefault();

        if (!form) {
            return;
        }

        clearFormErrors(form);

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const item = selectedItem();

        if (!item) {
            showModalError('Sélectionnez une ligne d’achat à réceptionner.');
            return;
        }

        const remaining = Math.max(
            0,
            Number(item.quantity_ordered) - Number(item.quantity_received)
        );
        const quantity = Number(quantityInput.value);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            showModalError('La quantité reçue doit être un entier positif.');
            return;
        }

        if (quantity > remaining) {
            showModalError(
                `La quantité reçue ne peut pas dépasser le restant (${remaining}).`
            );
            return;
        }

        const manufacturingDate = manufacturingInput.value || null;
        const expiryDate = expiryInput.value || null;

        if (
            manufacturingDate
            && expiryDate
            && manufacturingDate > expiryDate
        ) {
            showModalError(
                'La date d’expiration doit être postérieure à la date de fabrication.'
            );
            return;
        }

        const payload = {
            items: [
                {
                    purchase_item: Number(item.id),
                    quantity,
                    batch_number: batchNumberInput.value.trim(),
                    manufacturing_date: manufacturingDate,
                    expiry_date: expiryDate,
                    notes: notesInput.value.trim(),
                },
            ],
        };

        setButtonLoading(submitButton, true, 'Réception...');

        try {
            await api(`/api/purchases/purchases/${purchaseId}/receive/`, {
                method: 'POST',
                body: payload,
            });

            closeModal(modal);
            toast('La réception a été enregistrée et le stock a été mis à jour.', 'success');
            await loadAll();
        } catch (error) {
            if (error.status === 401) {
                handleError(error);
                return;
            }

            showFormErrors(form, error);
            handleError(error, 'Impossible d’enregistrer la réception.');
        } finally {
            setButtonLoading(submitButton, false);
        }
    }

    if (receiveButton) {
        receiveButton.addEventListener('click', () => openReceiveModal());
    }

    if (itemsBody) {
        itemsBody.addEventListener('click', (event) => {
            const button = event.target.closest('[data-receive-item]');

            if (button) {
                openReceiveModal(button.dataset.receiveItem);
            }
        });
    }

    if (itemSelect) {
        itemSelect.addEventListener('change', () => {
            clearFormErrors(form);
            updateSelectedItem();
        });
    }

    if (form) {
        form.addEventListener('submit', submitReceive);
    }

    loadAll(new URLSearchParams(window.location.search).get('created') === '1');
})();

/* Gestion de la page HTML de création d'une vente. */
(function () {
    'use strict';

    const {
        api,
        toast,
        confirmDialog,
        formatMoney,
        escapeHtml,
        setButtonLoading,
    } = window.PharmaStock;

    const MEDICINES_URL = '/api/medicines/medicines/';
    const BATCHES_URL = '/api/inventory/batches/';
    const CREATE_SALE_URL = '/api/sales/create/';

    const page = document.getElementById('saleCreatePage');

    if (!page) {
        return;
    }

    const pageError = document.getElementById('saleCreateError');
    const medicineSelect = document.getElementById('saleMedicineSelect');
    const medicineHelp = document.getElementById('saleMedicineHelp');
    const quantityInput = document.getElementById('saleQuantityInput');
    const addButton = document.getElementById('addSaleLineButton');
    const cartBody = document.getElementById('saleCartBody');
    const cartTotal = document.getElementById('saleCartTotal');
    const cartLineCount = document.getElementById('cartLineCount');
    const submitButton = document.getElementById('submitSaleButton');

    let availableMedicines = [];
    let cart = [];

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

        showPageError(error.message || fallback);
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

    async function loadMedicines() {
        hidePageError();

        try {
            const [medicinesData, batchesData] = await Promise.all([
                api(MEDICINES_URL),
                api(BATCHES_URL),
            ]);

            const medicines = asArray(medicinesData);
            const batches = asArray(batchesData);
            const stockByMedicine = new Map();

            batches.forEach((batch) => {
                if (Number(batch.quantity_available) <= 0 || isExpired(batch)) {
                    return;
                }

                const medicineId = String(batch.medicine);
                const current = stockByMedicine.get(medicineId) || 0;
                stockByMedicine.set(
                    medicineId,
                    current + Number(batch.quantity_available || 0)
                );
            });

            availableMedicines = medicines
                .filter((medicine) => (
                    medicine.is_active
                    && stockByMedicine.has(String(medicine.id))
                ))
                .map((medicine) => ({
                    id: Number(medicine.id),
                    name: medicine.name,
                    dosage: medicine.dosage || '',
                    unitPrice: Number(medicine.unit_price || 0),
                    available: stockByMedicine.get(String(medicine.id)) || 0,
                }))
                .sort((first, second) => first.name.localeCompare(
                    second.name,
                    'fr',
                    { sensitivity: 'base' }
                ));

            populateMedicineSelect();
        } catch (error) {
            handleError(error, 'Impossible de charger les médicaments disponibles.');
            medicineSelect.innerHTML = '<option value="">Chargement impossible</option>';
        }
    }

    function populateMedicineSelect() {
        if (availableMedicines.length === 0) {
            medicineSelect.innerHTML = '<option value="">Aucun médicament disponible</option>';
            medicineSelect.disabled = true;
            addButton.disabled = true;
            quantityInput.disabled = true;
            medicineHelp.textContent = 'Aucun médicament actif ne dispose de stock non expiré.';
            return;
        }

        medicineSelect.innerHTML = '<option value="">Sélectionner un médicament</option>';

        availableMedicines.forEach((medicine) => {
            const option = document.createElement('option');
            option.value = String(medicine.id);
            option.textContent = `${medicine.name}${medicine.dosage ? ` — ${medicine.dosage}` : ''} · stock : ${medicine.available} · ${formatMoney(medicine.unitPrice)}`;
            medicineSelect.appendChild(option);
        });

        medicineSelect.disabled = false;
        addButton.disabled = false;
        quantityInput.disabled = false;
        medicineHelp.textContent = 'Seuls les médicaments actifs avec du stock non expiré sont proposés.';
    }

    function findMedicine(medicineId) {
        return availableMedicines.find(
            (medicine) => Number(medicine.id) === Number(medicineId)
        ) || null;
    }

    function renderCart() {
        if (cart.length === 0) {
            cartBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <div class="empty-state-icon">🛒</div>
                            <h3>Le panier est vide</h3>
                            <p>Ajoutez au moins un médicament pour enregistrer une vente.</p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            cartBody.innerHTML = cart.map((line) => `
                <tr>
                    <td>
                        <span class="cell-main">${escapeHtml(line.name)}</span>
                        <span class="cell-sub">Stock disponible : ${line.available}</span>
                    </td>
                    <td class="text-right money">${formatMoney(line.unitPrice)}</td>
                    <td class="text-right">
                        <input
                            type="number"
                            class="filter-input quantity-input"
                            min="1"
                            max="${line.available}"
                            step="1"
                            value="${line.quantity}"
                            data-cart-quantity="${line.id}"
                            aria-label="Quantité de ${escapeHtml(line.name)}"
                        >
                    </td>
                    <td class="text-right money">${formatMoney(line.unitPrice * line.quantity)}</td>
                    <td class="text-right">
                        <button
                            type="button"
                            class="btn btn-icon danger"
                            data-remove-line="${line.id}"
                            title="Retirer du panier"
                            aria-label="Retirer ${escapeHtml(line.name)} du panier"
                        >🗑</button>
                    </td>
                </tr>
            `).join('');
        }

        const total = cart.reduce(
            (sum, line) => sum + (line.unitPrice * line.quantity),
            0
        );
        const totalQuantity = cart.reduce(
            (sum, line) => sum + line.quantity,
            0
        );

        cartTotal.textContent = formatMoney(total);
        cartLineCount.textContent = cart.length === 0
            ? 'Aucun médicament ajouté.'
            : `${cart.length} ligne(s) · ${totalQuantity} article(s)`;
        submitButton.disabled = cart.length === 0;
    }

    function addLine() {
        hidePageError();

        const medicine = findMedicine(medicineSelect.value);
        const quantity = Number(quantityInput.value);

        if (!medicine) {
            toast('Sélectionnez un médicament.', 'warning');
            return;
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
            toast('La quantité doit être un entier positif.', 'warning');
            return;
        }

        const existing = cart.find((line) => line.id === medicine.id);
        const nextQuantity = (existing ? existing.quantity : 0) + quantity;

        if (nextQuantity > medicine.available) {
            toast(
                `Stock insuffisant pour « ${medicine.name} » : ${medicine.available} disponible(s).`,
                'warning'
            );
            return;
        }

        if (existing) {
            existing.quantity = nextQuantity;
        } else {
            cart.push({
                id: medicine.id,
                name: medicine.name,
                unitPrice: medicine.unitPrice,
                available: medicine.available,
                quantity,
            });
        }

        quantityInput.value = '1';
        medicineSelect.value = '';
        renderCart();
    }

    function updateQuantity(medicineId, value) {
        const line = cart.find((item) => Number(item.id) === Number(medicineId));

        if (!line) {
            return;
        }

        const quantity = Number(value);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            toast('La quantité doit être un entier positif.', 'warning');
            renderCart();
            return;
        }

        if (quantity > line.available) {
            toast(
                `Stock insuffisant pour « ${line.name} » : ${line.available} disponible(s).`,
                'warning'
            );
            line.quantity = line.available;
            renderCart();
            return;
        }

        line.quantity = quantity;
        renderCart();
    }

    function removeLine(medicineId) {
        cart = cart.filter((line) => Number(line.id) !== Number(medicineId));
        renderCart();
    }

    async function submitSale() {
        hidePageError();

        if (cart.length === 0) {
            toast('Ajoutez au moins un médicament au panier.', 'warning');
            return;
        }

        const total = cart.reduce(
            (sum, line) => sum + (line.unitPrice * line.quantity),
            0
        );
        const totalQuantity = cart.reduce(
            (sum, line) => sum + line.quantity,
            0
        );

        const confirmed = await confirmDialog({
            title: 'Valider la vente',
            message: `Confirmer la vente de ${totalQuantity} article(s) pour un total estimé de ${formatMoney(total)} ?`,
            confirmText: 'Valider la vente',
        });

        if (!confirmed) {
            return;
        }

        const payload = {
            items: cart.map((line) => ({
                medicine_id: line.id,
                quantity: line.quantity,
            })),
        };

        setButtonLoading(submitButton, true, 'Validation...');

        try {
            const sale = await api(CREATE_SALE_URL, {
                method: 'POST',
                body: payload,
            });

            toast('La vente a été enregistrée avec succès.', 'success');
            window.location.href = `/sales/${sale.id}/?created=1`;
        } catch (error) {
            handleError(error, 'Impossible d’enregistrer la vente.');
        } finally {
            setButtonLoading(submitButton, false);
        }
    }

    if (addButton) {
        addButton.addEventListener('click', addLine);
    }

    if (quantityInput) {
        quantityInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addLine();
            }
        });
    }

    if (cartBody) {
        cartBody.addEventListener('change', (event) => {
            const input = event.target.closest('[data-cart-quantity]');

            if (input) {
                updateQuantity(input.dataset.cartQuantity, input.value);
            }
        });

        cartBody.addEventListener('click', (event) => {
            const removeButton = event.target.closest('[data-remove-line]');

            if (removeButton) {
                removeLine(removeButton.dataset.removeLine);
            }
        });
    }

    if (submitButton) {
        submitButton.addEventListener('click', submitSale);
    }

    renderCart();
    loadMedicines();
})();

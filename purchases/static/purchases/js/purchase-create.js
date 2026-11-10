/* Gestion de la page HTML de création d'un achat. */
(function () {
    'use strict';

    const {
        api,
        toast,
        confirmDialog,
        formatMoney,
        setButtonLoading,
    } = window.PharmaStock;

    const SUPPLIERS_URL = '/api/suppliers/suppliers/';
    const MEDICINES_URL = '/api/medicines/medicines/';
    const PURCHASES_URL = '/api/purchases/purchases/';

    const page = document.getElementById('purchaseCreatePage');

    if (!page) {
        return;
    }

    const form = document.getElementById('purchaseForm');
    const pageError = document.getElementById('purchaseCreateError');
    const supplierSelect = document.getElementById('purchaseSupplier');
    const expectedDateInput = document.getElementById('purchaseExpectedDate');
    const notesInput = document.getElementById('purchaseNotes');
    const itemsBody = document.getElementById('purchaseItemsBody');
    const addButton = document.getElementById('addPurchaseItemButton');
    const totalElement = document.getElementById('purchaseFormTotal');
    const submitButton = document.getElementById('submitPurchaseButton');

    let suppliers = [];
    let medicines = [];
    let rowSequence = 0;
    let optionsReady = false;

    function showPageError(message) {
        if (!pageError) {
            return;
        }

        pageError.textContent = message;
        pageError.classList.remove('hidden');
        pageError.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

        const message = error.message || fallback;
        showPageError(message);
        toast(message, 'error');
    }

    function asArray(data) {
        if (Array.isArray(data)) {
            return data;
        }

        return data && Array.isArray(data.results) ? data.results : [];
    }

    async function loadOptions() {
        try {
            const [suppliersData, medicinesData] = await Promise.all([
                api(SUPPLIERS_URL),
                api(MEDICINES_URL),
            ]);

            suppliers = asArray(suppliersData).slice().sort((first, second) => (
                String(first.name).localeCompare(String(second.name), 'fr', {
                    sensitivity: 'base',
                })
            ));
            medicines = asArray(medicinesData)
                .filter((medicine) => medicine.is_active)
                .slice()
                .sort((first, second) => (
                    String(first.name).localeCompare(String(second.name), 'fr', {
                        sensitivity: 'base',
                    })
                ));

            populateSuppliers();
            optionsReady = suppliers.length > 0 && medicines.length > 0;
            itemsBody.innerHTML = '';

            if (medicines.length > 0) {
                addItemRow();
            } else {
                itemsBody.innerHTML = `
                    <tr>
                        <td colspan="7">
                            <div class="empty-state">
                                <h3>Aucun médicament actif</h3>
                                <p>Activez au moins un médicament avant de créer un achat.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }

            addButton.disabled = medicines.length === 0;
            submitButton.disabled = !optionsReady;
        } catch (error) {
            itemsBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <h3>Chargement impossible</h3>
                            <p>Vérifiez votre connexion puis rechargez la page.</p>
                        </div>
                    </td>
                </tr>
            `;
            addButton.disabled = true;
            submitButton.disabled = true;
            handleError(error, 'Impossible de charger les fournisseurs et médicaments.');
        }
    }

    function populateSuppliers() {
        if (suppliers.length === 0) {
            supplierSelect.innerHTML = '<option value="">Aucun fournisseur disponible</option>';
            supplierSelect.disabled = true;
            return;
        }

        supplierSelect.innerHTML = '<option value="">Sélectionner un fournisseur</option>';

        suppliers.forEach((supplier) => {
            const option = document.createElement('option');
            option.value = String(supplier.id);
            option.textContent = supplier.is_active
                ? supplier.name
                : `${supplier.name} (inactif)`;
            supplierSelect.appendChild(option);
        });

        supplierSelect.disabled = false;
    }

    function createMedicineSelect() {
        const select = document.createElement('select');
        select.className = 'purchase-item-medicine';
        select.required = true;

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Sélectionner...';
        select.appendChild(placeholder);

        medicines.forEach((medicine) => {
            const option = document.createElement('option');
            option.value = String(medicine.id);
            option.textContent = `${medicine.name}${medicine.dosage ? ` — ${medicine.dosage}` : ''}`;
            select.appendChild(option);
        });

        return select;
    }

    function addItemRow() {
        if (medicines.length === 0) {
            return;
        }

        rowSequence += 1;

        const row = document.createElement('tr');
        row.dataset.rowId = String(rowSequence);

        const medicineCell = document.createElement('td');
        medicineCell.appendChild(createMedicineSelect());

        const quantityCell = document.createElement('td');
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.className = 'purchase-item-quantity';
        quantityInput.min = '1';
        quantityInput.step = '1';
        quantityInput.value = '1';
        quantityInput.required = true;
        quantityCell.appendChild(quantityInput);

        const priceCell = document.createElement('td');
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.className = 'purchase-item-price';
        priceInput.min = '0';
        priceInput.step = '0.01';
        priceInput.placeholder = '0.00';
        priceInput.required = true;
        priceCell.appendChild(priceInput);

        const manufacturingCell = document.createElement('td');
        const manufacturingInput = document.createElement('input');
        manufacturingInput.type = 'date';
        manufacturingInput.className = 'purchase-item-manufacturing';
        manufacturingCell.appendChild(manufacturingInput);

        const expiryCell = document.createElement('td');
        const expiryInput = document.createElement('input');
        expiryInput.type = 'date';
        expiryInput.className = 'purchase-item-expiry';
        expiryCell.appendChild(expiryInput);

        const subtotalCell = document.createElement('td');
        subtotalCell.className = 'text-right purchase-item-subtotal';
        subtotalCell.textContent = formatMoney(0);

        const actionCell = document.createElement('td');
        actionCell.className = 'text-right';
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn btn-icon danger';
        removeButton.dataset.removeRow = String(rowSequence);
        removeButton.title = 'Supprimer la ligne';
        removeButton.setAttribute('aria-label', 'Supprimer la ligne');
        removeButton.textContent = '🗑';
        actionCell.appendChild(removeButton);

        row.appendChild(medicineCell);
        row.appendChild(quantityCell);
        row.appendChild(priceCell);
        row.appendChild(manufacturingCell);
        row.appendChild(expiryCell);
        row.appendChild(subtotalCell);
        row.appendChild(actionCell);
        itemsBody.appendChild(row);

        updateRemoveButtons();
        updateRowTotal(row);
        medicineCell.querySelector('select').focus();
    }

    function rows() {
        return Array.from(itemsBody.querySelectorAll('tr[data-row-id]'));
    }

    function updateRemoveButtons() {
        const currentRows = rows();
        currentRows.forEach((row) => {
            const button = row.querySelector('[data-remove-row]');

            if (button) {
                button.disabled = currentRows.length <= 1;
            }
        });
    }

    function rowSubtotal(row) {
        const quantity = Number(row.querySelector('.purchase-item-quantity').value);
        const price = Number(row.querySelector('.purchase-item-price').value);

        if (!Number.isFinite(quantity) || !Number.isFinite(price)) {
            return 0;
        }

        return Math.max(0, quantity) * Math.max(0, price);
    }

    function updateRowTotal(row) {
        const subtotalCell = row.querySelector('.purchase-item-subtotal');

        if (subtotalCell) {
            subtotalCell.textContent = formatMoney(rowSubtotal(row));
        }

        updateTotal();
    }

    function updateTotal() {
        const total = rows().reduce(
            (sum, row) => sum + rowSubtotal(row),
            0
        );

        totalElement.textContent = formatMoney(total);
    }

    function removeRow(button) {
        const currentRows = rows();

        if (currentRows.length <= 1) {
            toast('Un achat doit contenir au moins une ligne.', 'warning');
            return;
        }

        const row = button.closest('tr');

        if (row) {
            row.remove();
            updateRemoveButtons();
            updateTotal();
        }
    }

    function collectPayload() {
        if (!supplierSelect.value) {
            throw new Error('Sélectionnez un fournisseur.');
        }

        const currentRows = rows();

        if (currentRows.length === 0) {
            throw new Error('Ajoutez au moins une ligne de commande.');
        }

        const seenMedicines = new Set();
        const items = currentRows.map((row, index) => {
            const medicineSelect = row.querySelector('.purchase-item-medicine');
            const quantityInput = row.querySelector('.purchase-item-quantity');
            const priceInput = row.querySelector('.purchase-item-price');
            const manufacturingInput = row.querySelector('.purchase-item-manufacturing');
            const expiryInput = row.querySelector('.purchase-item-expiry');
            const lineNumber = index + 1;

            if (!medicineSelect.value) {
                throw new Error(`Sélectionnez un médicament sur la ligne ${lineNumber}.`);
            }

            if (seenMedicines.has(medicineSelect.value)) {
                throw new Error(
                    'Un médicament ne peut apparaître qu’une seule fois dans l’achat.'
                );
            }

            seenMedicines.add(medicineSelect.value);

            const quantity = Number(quantityInput.value);

            if (!Number.isInteger(quantity) || quantity <= 0) {
                throw new Error(
                    `La quantité de la ligne ${lineNumber} doit être un entier positif.`
                );
            }

            if (String(priceInput.value).trim() === '') {
                throw new Error(`Renseignez le prix unitaire de la ligne ${lineNumber}.`);
            }

            const price = Number(priceInput.value);

            if (!Number.isFinite(price) || price < 0) {
                throw new Error(
                    `Le prix unitaire de la ligne ${lineNumber} doit être positif ou nul.`
                );
            }

            const manufacturingDate = manufacturingInput.value || null;
            const expiryDate = expiryInput.value || null;

            if (
                manufacturingDate
                && expiryDate
                && manufacturingDate > expiryDate
            ) {
                throw new Error(
                    `La date d’expiration de la ligne ${lineNumber} doit être postérieure à la fabrication.`
                );
            }

            return {
                medicine: Number(medicineSelect.value),
                quantity_ordered: quantity,
                unit_price: price.toFixed(2),
                manufacturing_date: manufacturingDate,
                expiry_date: expiryDate,
                notes: '',
            };
        });

        return {
            supplier: Number(supplierSelect.value),
            expected_date: expectedDateInput.value || null,
            notes: notesInput.value.trim(),
            items,
        };
    }

    async function submitPurchase(event) {
        event.preventDefault();
        hidePageError();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        let payload;

        try {
            payload = collectPayload();
        } catch (error) {
            showPageError(error.message);
            toast(error.message, 'warning');
            return;
        }

        const total = payload.items.reduce(
            (sum, item) => sum + (item.quantity_ordered * Number(item.unit_price)),
            0
        );
        const supplier = suppliers.find(
            (entry) => Number(entry.id) === payload.supplier
        );
        const totalQuantity = payload.items.reduce(
            (sum, item) => sum + item.quantity_ordered,
            0
        );

        const confirmed = await confirmDialog({
            title: 'Enregistrer l’achat',
            message: `Créer la commande de ${totalQuantity} unité(s) auprès de « ${supplier ? supplier.name : '—'} » pour un total de ${formatMoney(total)} ?`,
            confirmText: 'Enregistrer l’achat',
        });

        if (!confirmed) {
            return;
        }

        setButtonLoading(submitButton, true, 'Enregistrement...');

        try {
            const purchase = await api(PURCHASES_URL, {
                method: 'POST',
                body: payload,
            });

            toast('L’achat a été créé avec succès.', 'success');
            window.location.href = `/purchases/${purchase.id}/?created=1`;
        } catch (error) {
            handleError(error, 'Impossible d’enregistrer l’achat.');
        } finally {
            setButtonLoading(submitButton, false);
        }
    }

    if (addButton) {
        addButton.addEventListener('click', addItemRow);
    }

    if (itemsBody) {
        itemsBody.addEventListener('input', (event) => {
            const row = event.target.closest('tr[data-row-id]');

            if (row) {
                updateRowTotal(row);
            }
        });

        itemsBody.addEventListener('change', (event) => {
            const row = event.target.closest('tr[data-row-id]');

            if (row) {
                updateRowTotal(row);
            }
        });

        itemsBody.addEventListener('click', (event) => {
            const removeButton = event.target.closest('[data-remove-row]');

            if (removeButton) {
                removeRow(removeButton);
            }
        });
    }

    if (form) {
        form.addEventListener('submit', submitPurchase);
    }

    updateTotal();
    loadOptions();
})();

/* Gestion de la page HTML des mouvements de stock. */
(function () {
    'use strict';

    const {
        api,
        toast,
        openModal,
        closeModal,
        formatDate,
        formatDateTime,
        escapeHtml,
        debounce,
        clearFormErrors,
        showFormErrors,
        setButtonLoading,
        renderPagination,
        emptyState,
    } = window.PharmaStock;

    const MOVEMENTS_URL = '/api/inventory/movements/';
    const REGISTER_URL = '/api/inventory/movements/register/';
    const BATCHES_URL = '/api/inventory/batches/';
    const PAGE_SIZE = 10;

    const MOVEMENT_LABELS = {
        IN: 'Entrée',
        OUT: 'Sortie',
        ADJUSTMENT: 'Ajustement',
    };

    const DIRECTION_LABELS = {
        INCREASE: 'Augmentation',
        DECREASE: 'Diminution',
    };

    const page = document.getElementById('movementPage');

    if (!page) {
        return;
    }

    const pageAlert = document.getElementById('movementPageAlert');
    const searchInput = document.getElementById('movementSearch');
    const typeFilter = document.getElementById('movementTypeFilter');
    const batchFilter = document.getElementById('movementBatchFilter');
    const resetButton = document.getElementById('resetMovementFilters');
    const resultCount = document.getElementById('movementResultCount');
    const tableBody = document.getElementById('movementTableBody');
    const pagination = document.getElementById('movementPagination');
    const totalCount = document.getElementById('movementTotalCount');
    const inCount = document.getElementById('movementInCount');
    const outCount = document.getElementById('movementOutCount');
    const adjustmentCount = document.getElementById('movementAdjustmentCount');

    const addButton = document.getElementById('addMovementButton');
    const modal = document.getElementById('movementModal');
    const form = document.getElementById('movementForm');
    const submitButton = document.getElementById('movementSubmitButton');
    const batchSelect = document.getElementById('movementBatch');
    const movementTypeSelect = document.getElementById('movementType');
    const directionGroup = document.getElementById('adjustmentDirectionGroup');
    const directionSelect = document.getElementById('adjustmentDirection');
    const quantityInput = document.getElementById('movementQuantity');
    const reasonInput = document.getElementById('movementReason');
    const batchInfo = document.getElementById('movementBatchInfo');

    let movements = [];
    let batches = [];
    let filteredMovements = [];
    let currentPage = 1;
    let batchFromQuery = new URLSearchParams(window.location.search).get('batch');

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
            const [movementsData, batchesData] = await Promise.all([
                api(MOVEMENTS_URL),
                api(BATCHES_URL),
            ]);

            movements = asArray(movementsData);
            batches = asArray(batchesData);

            populateBatchOptions();
            applyFilters(false);
            handleBatchFromQuery();
        } catch (error) {
            showPageError(error.message || 'Impossible de charger les mouvements.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">${emptyState(
                        'Vérifiez votre connexion puis rechargez la page.',
                        'Chargement impossible'
                    )}</td>
                </tr>
            `;
            handleError(error, 'Impossible de charger les mouvements.');
        }
    }

    function batchLabel(batch) {
        return `${batch.medicine_name} — ${batch.batch_number}`;
    }

    function populateBatchOptions() {
        if (!batchFilter || !batchSelect) {
            return;
        }

        const previousFilter = batchFilter.value;
        const previousBatch = batchSelect.value;
        const sortedBatches = batches.slice().sort((first, second) => (
            batchLabel(first).localeCompare(batchLabel(second), 'fr', {
                sensitivity: 'base',
            })
        ));

        batchFilter.innerHTML = '<option value="">Tous les lots</option>';
        batchSelect.innerHTML = '<option value="">Sélectionner un lot</option>';

        sortedBatches.forEach((batch) => {
            const filterOption = document.createElement('option');
            filterOption.value = String(batch.id);
            filterOption.textContent = batchLabel(batch);
            batchFilter.appendChild(filterOption);

            const selectOption = document.createElement('option');
            selectOption.value = String(batch.id);
            selectOption.textContent = `${batchLabel(batch)} (dispo : ${batch.quantity_available})`;
            batchSelect.appendChild(selectOption);
        });

        if (
            previousFilter
            && sortedBatches.some((batch) => String(batch.id) === previousFilter)
        ) {
            batchFilter.value = previousFilter;
        }

        if (
            previousBatch
            && sortedBatches.some((batch) => String(batch.id) === previousBatch)
        ) {
            batchSelect.value = previousBatch;
        }

        updateBatchInfo();
    }

    function renderStats() {
        totalCount.textContent = String(movements.length);
        inCount.textContent = String(
            movements.filter((movement) => movement.movement_type === 'IN').length
        );
        outCount.textContent = String(
            movements.filter((movement) => movement.movement_type === 'OUT').length
        );
        adjustmentCount.textContent = String(
            movements.filter((movement) => movement.movement_type === 'ADJUSTMENT').length
        );
    }

    function applyFilters(resetPage = true) {
        const search = (searchInput.value || '').trim().toLowerCase();
        const type = typeFilter.value;
        const batch = batchFilter.value;

        filteredMovements = movements.filter((movement) => {
            const matchesSearch = !search
                || (movement.medicine_name || '').toLowerCase().includes(search)
                || (movement.batch_number || '').toLowerCase().includes(search)
                || (movement.reason || '').toLowerCase().includes(search)
                || (movement.performed_by_username || '').toLowerCase().includes(search);

            const matchesType = !type || movement.movement_type === type;
            const matchesBatch = !batch || String(movement.batch) === batch;

            return matchesSearch && matchesType && matchesBatch;
        });

        filteredMovements.sort((first, second) => (
            new Date(second.created_at) - new Date(first.created_at)
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

        resultCount.textContent = `${filteredMovements.length} mouvement(s)`;
    }

    function typeBadge(type) {
        const classes = {
            IN: 'badge-success',
            OUT: 'badge-info',
            ADJUSTMENT: 'badge-warning',
        };

        return `<span class="badge ${classes[type] || 'badge-neutral'}">${escapeHtml(MOVEMENT_LABELS[type] || type)}</span>`;
    }

    function renderTable() {
        const pages = Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE));

        if (currentPage > pages) {
            currentPage = pages;
        }

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredMovements.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8">
                        ${emptyState(
                            'Aucun mouvement ne correspond à votre recherche.',
                            'Aucun mouvement'
                        )}
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = pageItems.map((movement) => `
                <tr>
                    <td class="nowrap">${formatDateTime(movement.created_at)}</td>
                    <td>${escapeHtml(movement.medicine_name || '—')}</td>
                    <td>${escapeHtml(movement.batch_number || '—')}</td>
                    <td>${typeBadge(movement.movement_type)}</td>
                    <td>${escapeHtml(DIRECTION_LABELS[movement.adjustment_direction] || '—')}</td>
                    <td class="text-right">${Number(movement.quantity || 0)}</td>
                    <td>${escapeHtml(movement.reason || '—')}</td>
                    <td>${escapeHtml(movement.performed_by_username || '—')}</td>
                </tr>
            `).join('');
        }

        renderPagination(pagination, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            total: filteredMovements.length,
            onChange: (newPage) => {
                currentPage = newPage;
                renderTable();
            },
        });
    }

    function selectedBatch() {
        if (!batchSelect) {
            return null;
        }

        return batches.find(
            (batch) => String(batch.id) === batchSelect.value
        ) || null;
    }

    function updateBatchInfo() {
        if (!batchInfo) {
            return;
        }

        const batch = selectedBatch();

        if (!batch) {
            batchInfo.textContent = 'Sélectionnez un lot pour afficher sa quantité disponible et sa date d’expiration.';
            batchInfo.className = 'alert alert-info';
            batchInfo.classList.remove('hidden');
            return;
        }

        const mood = new Date();
        const today = new Date(mood.getFullYear(), mood.getMonth(), mood.getDate());
        const expiryParts = String(batch.expiry_date || '').split('-').map(Number);
        const expiry = expiryParts.length === 3 && !expiryParts.some(Number.isNaN)
            ? new Date(expiryParts[0], expiryParts[1] - 1, expiryParts[2])
            : null;
        const isExpired = expiry && expiry < today;

        batchInfo.textContent = `Stock disponible : ${batch.quantity_available} · Expiration : ${formatDate(batch.expiry_date)}${isExpired ? ' · Lot expiré : les entrées et sorties sont interdites.' : ''}`;
        batchInfo.className = isExpired
            ? 'alert alert-warning'
            : 'alert alert-info';
        batchInfo.classList.remove('hidden');
    }

    function updateDirectionVisibility() {
        if (!movementTypeSelect || !directionGroup || !directionSelect || !reasonInput) {
            return;
        }

        const isAdjustment = movementTypeSelect.value === 'ADJUSTMENT';

        directionGroup.classList.toggle('hidden', !isAdjustment);
        directionSelect.required = isAdjustment;
        reasonInput.required = isAdjustment;

        if (!isAdjustment) {
            directionSelect.value = '';
        }
    }

    function resetForm() {
        if (!form) {
            return;
        }

        form.reset();
        clearFormErrors(form);
        batchSelect.value = '';
        movementTypeSelect.value = 'IN';
        directionSelect.value = '';
        updateDirectionVisibility();
        updateBatchInfo();
    }

    function openMovementModal(batchId = '') {
        if (!modal || !form) {
            return;
        }

        resetForm();

        if (batchId) {
            const exists = batches.some(
                (batch) => String(batch.id) === String(batchId)
            );

            if (exists) {
                batchSelect.value = String(batchId);
                updateBatchInfo();
            }
        }

        openModal(modal);
    }

    function handleBatchFromQuery() {
        if (!batchFromQuery) {
            return;
        }

        const requested = batchFromQuery;
        batchFromQuery = null;

        if (batches.some((batch) => String(batch.id) === String(requested))) {
            openMovementModal(requested);
        }
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

        const movementType = movementTypeSelect.value;
        const payload = {
            batch: Number(batchSelect.value),
            movement_type: movementType,
            quantity: Number(quantityInput.value),
            reason: reasonInput.value.trim(),
        };

        if (!payload.batch) {
            toast('Sélectionnez un lot.', 'warning');
            return;
        }

        if (movementType === 'ADJUSTMENT') {
            payload.adjustment_direction = directionSelect.value;

            if (!payload.adjustment_direction) {
                toast('Précisez le sens de l’ajustement.', 'warning');
                return;
            }

            if (!payload.reason) {
                toast('Le motif est obligatoire pour un ajustement.', 'warning');
                return;
            }
        }

        setButtonLoading(submitButton, true, 'Enregistrement...');

        try {
            await api(REGISTER_URL, {
                method: 'POST',
                body: payload,
            });

            closeModal(modal);
            toast(
                `Le mouvement « ${MOVEMENT_LABELS[movementType] || movementType} » a été enregistré.`,
                'success'
            );

            await loadData();
        } catch (error) {
            showFormErrors(form, error);
            handleError(error, 'Impossible d’enregistrer le mouvement.');
        } finally {
            setButtonLoading(submitButton, false);
        }
    }

    if (tableBody) {
        tableBody.addEventListener('click', () => {
            // Aucun bouton d'action dans cette table pour le moment.
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => applyFilters(true), 250));
    }

    if (typeFilter) {
        typeFilter.addEventListener('change', () => applyFilters(true));
    }

    if (batchFilter) {
        batchFilter.addEventListener('change', () => applyFilters(true));
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            searchInput.value = '';
            typeFilter.value = '';
            batchFilter.value = '';
            applyFilters(true);
        });
    }

    if (addButton) {
        addButton.addEventListener('click', () => openMovementModal());
    }

    if (batchSelect) {
        batchSelect.addEventListener('change', updateBatchInfo);
    }

    if (movementTypeSelect) {
        movementTypeSelect.addEventListener('change', updateDirectionVisibility);
    }

    if (form) {
        form.addEventListener('submit', submitForm);
    }

    updateDirectionVisibility();
    updateBatchInfo();
    loadData();
})();

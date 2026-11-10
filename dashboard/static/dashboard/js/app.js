/*
 * PharmaStock - utilitaires communs aux pages HTML.
 *
 * Ce fichier ne contient aucune règle métier : il facilite uniquement
 * les appels aux APIs existantes, l'affichage des messages et la pagination.
 */
(function (window, document) {
    'use strict';

    const PharmaStock = {};

    /* ------------------------------------------------------------------ */
    /* CSRF et appels API                                                  */
    /* ------------------------------------------------------------------ */

    function getCookie(name) {
        const cookie = `; ${document.cookie}`;
        const parts = cookie.split(`; ${name}=`);

        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }

        return '';
    }

    function getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');

        if (meta && meta.content) {
            return meta.content;
        }

        return getCookie('csrftoken');
    }

    class ApiError extends Error {
        constructor(message, status, data) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.data = data;
        }
    }

    function extractErrorMessage(data, fallback) {
        if (data === null || data === undefined || data === '') {
            return fallback;
        }

        if (typeof data === 'string') {
            const text = data.trim();

            if (text.startsWith('<')) {
                return fallback;
            }

            return text || fallback;
        }

        if (Array.isArray(data)) {
            const messages = data
                .map((item) => extractErrorMessage(item, ''))
                .filter(Boolean);

            return messages.length ? messages.join(' ') : fallback;
        }

        if (typeof data === 'object') {
            if (data.detail) {
                return extractErrorMessage(data.detail, fallback);
            }

            if (data.error) {
                return extractErrorMessage(data.error, fallback);
            }

            const messages = [];

            Object.keys(data).forEach((key) => {
                const value = data[key];
                const text = extractErrorMessage(value, '');

                if (text) {
                    if (key === 'non_field_errors') {
                        messages.push(text);
                    } else {
                        messages.push(`${key} : ${text}`);
                    }
                }
            });

            return messages.length ? messages.join(' | ') : fallback;
        }

        return String(data);
    }

    async function api(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const headers = new Headers(options.headers || {});
        let body = options.body;

        headers.set('Accept', 'application/json');

        if (body && !(body instanceof FormData) && typeof body !== 'string') {
            headers.set('Content-Type', 'application/json');
            body = JSON.stringify(body);
        } else if (body && typeof body === 'string' && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
            const token = getCsrfToken();

            if (token) {
                headers.set('X-CSRFToken', token);
            }
        }

        const response = await fetch(url, {
            ...options,
            method,
            headers,
            body,
            credentials: 'same-origin',
        });

        let data = null;

        if (response.status !== 204) {
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (error) {
                    data = null;
                }
            } else {
                data = await response.text();
            }
        }

        if (!response.ok) {
            const message = extractErrorMessage(
                data,
                `Erreur HTTP ${response.status}.`
            );

            throw new ApiError(message, response.status, data);
        }

        return data;
    }

    /* ------------------------------------------------------------------ */
    /* Notifications                                                       */
    /* ------------------------------------------------------------------ */

    function getToastContainer() {
        let container = document.getElementById('toastContainer');

        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }

        return container;
    }

    function toast(message, type = 'success', duration = 4200) {
        const container = getToastContainer();
        const element = document.createElement('div');
        const icons = {
            success: '✓',
            error: '!',
            warning: '⚠',
            info: 'i',
        };

        element.className = `toast toast-${type}`;
        element.setAttribute('role', type === 'error' ? 'alert' : 'status');

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.textContent = icons[type] || icons.info;

        const text = document.createElement('span');
        text.className = 'toast-message';
        text.textContent = message;

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'toast-close';
        close.setAttribute('aria-label', 'Fermer la notification');
        close.textContent = '×';

        const remove = () => {
            element.classList.add('toast-hide');
            window.setTimeout(() => element.remove(), 220);
        };

        close.addEventListener('click', remove);
        element.appendChild(icon);
        element.appendChild(text);
        element.appendChild(close);
        container.appendChild(element);

        if (duration > 0) {
            window.setTimeout(remove, duration);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Modales                                                             */
    /* ------------------------------------------------------------------ */

    function openModal(target) {
        const element = typeof target === 'string'
            ? document.getElementById(target)
            : target;

        if (!element) {
            return;
        }

        element.classList.remove('hidden');
        document.body.classList.add('modal-open');

        const focusable = element.querySelector(
            'input:not([type="hidden"]), select, textarea, button'
        );

        if (focusable) {
            window.setTimeout(() => focusable.focus(), 20);
        }
    }

    function closeModal(target) {
        const element = typeof target === 'string'
            ? document.getElementById(target)
            : target;

        if (!element) {
            return;
        }

        element.classList.add('hidden');

        if (!document.querySelector('.modal-backdrop:not(.hidden)')) {
            document.body.classList.remove('modal-open');
        }
    }

    function confirmDialog({
        title = 'Confirmation',
        message = '',
        confirmText = 'Confirmer',
        cancelText = 'Annuler',
        danger = false,
    } = {}) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.dataset.confirmDialog = 'true';

            const modal = document.createElement('div');
            modal.className = 'modal modal-small';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');

            const header = document.createElement('div');
            header.className = 'modal-header';

            const heading = document.createElement('h3');
            heading.textContent = title;

            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'modal-close';
            closeButton.setAttribute('aria-label', 'Fermer');
            closeButton.textContent = '×';

            header.appendChild(heading);
            header.appendChild(closeButton);

            const body = document.createElement('div');
            body.className = 'modal-body';

            const paragraph = document.createElement('p');
            paragraph.className = 'confirm-message';
            paragraph.textContent = message;

            body.appendChild(paragraph);

            const footer = document.createElement('div');
            footer.className = 'modal-footer';

            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'btn btn-secondary';
            cancel.textContent = cancelText;

            const confirm = document.createElement('button');
            confirm.type = 'button';
            confirm.className = danger ? 'btn btn-danger' : 'btn btn-primary';
            confirm.textContent = confirmText;

            footer.appendChild(cancel);
            footer.appendChild(confirm);

            modal.appendChild(header);
            modal.appendChild(body);
            modal.appendChild(footer);
            backdrop.appendChild(modal);

            const cleanup = (result) => {
                document.removeEventListener('keydown', onKeyDown);
                backdrop.remove();
                resolve(result);
            };

            const onKeyDown = (event) => {
                if (event.key === 'Escape') {
                    cleanup(false);
                }
            };

            closeButton.addEventListener('click', () => cleanup(false));
            cancel.addEventListener('click', () => cleanup(false));
            confirm.addEventListener('click', () => cleanup(true));
            backdrop.addEventListener('click', (event) => {
                if (event.target === backdrop) {
                    cleanup(false);
                }
            });
            document.addEventListener('keydown', onKeyDown);

            document.body.appendChild(backdrop);
            document.body.classList.add('modal-open');
            window.setTimeout(() => confirm.focus(), 20);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Formatage                                                           */
    /* ------------------------------------------------------------------ */

    function formatNumber(value) {
        return new Intl.NumberFormat('fr-FR', {
            maximumFractionDigits: 2,
        }).format(Number(value || 0));
    }

    function formatMoney(value) {
        return `${formatNumber(value)} BIF`;
    }

    function parseDate(value) {
        if (!value) {
            return null;
        }

        const stringValue = String(value);
        const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(stringValue)
            ? `${stringValue}T00:00:00`
            : stringValue;
        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date;
    }

    function formatDate(value) {
        const date = parseDate(value);

        if (!date) {
            return '—';
        }

        return date.toLocaleDateString('fr-FR');
    }

    function formatDateTime(value) {
        const date = parseDate(value);

        if (!date) {
            return '—';
        }

        return date.toLocaleString('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
        });
    }

    function escapeHtml(value) {
        const replacements = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };

        return String(value === null || value === undefined ? '' : value)
            .replace(/[&<>"']/g, (character) => replacements[character]);
    }

    function debounce(callback, delay = 300) {
        let timer = null;

        return function debounced(...args) {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => callback.apply(this, args), delay);
        };
    }

    /* ------------------------------------------------------------------ */
    /* Formulaires                                                         */
    /* ------------------------------------------------------------------ */

    function clearFormErrors(form) {
        if (!form) {
            return;
        }

        form.querySelectorAll('[data-error-for]').forEach((element) => {
            element.textContent = '';
            element.classList.add('hidden');
        });

        const summary = form.querySelector('[data-form-error]');

        if (summary) {
            summary.textContent = '';
            summary.classList.add('hidden');
        }
    }

    function showFormErrors(form, error) {
        if (!form) {
            return;
        }

        clearFormErrors(form);

        const summary = form.querySelector('[data-form-error]');

        if (summary) {
            summary.textContent = error.message || 'Une erreur est survenue.';
            summary.classList.remove('hidden');
        }

        const data = error.data;

        if (data && typeof data === 'object' && !Array.isArray(data)) {
            Object.keys(data).forEach((field) => {
                const target = form.querySelector(
                    `[data-error-for="${field}"]`
                );

                if (target) {
                    const value = data[field];
                    target.textContent = extractErrorMessage(value, '');
                    target.classList.remove('hidden');
                }
            });
        }
    }

    function setButtonLoading(button, loading, loadingText = 'Traitement...') {
        if (!button) {
            return;
        }

        if (loading) {
            if (!button.dataset.originalHtml) {
                button.dataset.originalHtml = button.innerHTML;
            }

            button.disabled = true;
            button.textContent = loadingText;
            return;
        }

        button.disabled = false;

        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Pagination                                                          */
    /* ------------------------------------------------------------------ */

    function renderPagination(container, {
        page,
        pageSize,
        total,
        onChange,
    }) {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (total === 0) {
            return;
        }

        const pages = Math.max(1, Math.ceil(total / pageSize));
        const currentPage = Math.min(Math.max(page, 1), pages);
        const first = (currentPage - 1) * pageSize + 1;
        const last = Math.min(currentPage * pageSize, total);

        const info = document.createElement('span');
        info.className = 'pagination-info';
        info.textContent = `${first}–${last} sur ${total}`;

        const controls = document.createElement('div');
        controls.className = 'pagination-controls';

        const previous = document.createElement('button');
        previous.type = 'button';
        previous.className = 'btn btn-secondary btn-sm';
        previous.textContent = '← Précédent';
        previous.disabled = currentPage <= 1;
        previous.addEventListener('click', () => onChange(currentPage - 1));

        const pageLabel = document.createElement('span');
        pageLabel.className = 'pagination-page';
        pageLabel.textContent = `Page ${currentPage} / ${pages}`;

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'btn btn-secondary btn-sm';
        next.textContent = 'Suivant →';
        next.disabled = currentPage >= pages;
        next.addEventListener('click', () => onChange(currentPage + 1));

        controls.appendChild(previous);
        controls.appendChild(pageLabel);
        controls.appendChild(next);
        container.appendChild(info);
        container.appendChild(controls);
    }

    /* ------------------------------------------------------------------ */
    /* Divers                                                              */
    /* ------------------------------------------------------------------ */

    function emptyState(message, title = 'Aucun résultat') {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">⌕</div>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }

    function loadingState(message = 'Chargement des données...') {
        return `
            <div class="loading-state">
                <span class="loading-dot"></span>
                ${escapeHtml(message)}
            </div>
        `;
    }

    /* ------------------------------------------------------------------ */
    /* Écouteurs globaux                                                   */
    /* ------------------------------------------------------------------ */

    document.addEventListener('click', (event) => {
        const closeButton = event.target.closest('[data-close-modal]');

        if (closeButton) {
            const modal = closeButton.closest('.modal-backdrop');

            if (modal) {
                closeModal(modal);
            }
        }

        const backdrop = event.target;

        if (
            backdrop.classList
            && backdrop.classList.contains('modal-backdrop')
            && !backdrop.dataset.confirmDialog
        ) {
            closeModal(backdrop);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }

        const modals = Array.from(
            document.querySelectorAll('.modal-backdrop:not(.hidden)')
        );

        const modal = modals[modals.length - 1];

        if (modal && !modal.dataset.confirmDialog) {
            closeModal(modal);
        }
    });

    /* ------------------------------------------------------------------ */
    /* Navigation                                                         */
    /* ------------------------------------------------------------------ */

    function revealActiveSidebarLink() {
        const nav = document.querySelector('.sidebar-nav');
        const active = nav && nav.querySelector('.nav-link.active');

        if (!nav || !active) {
            return;
        }

        const navRect = nav.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();

        if (activeRect.top < navRect.top || activeRect.bottom > navRect.bottom) {
            nav.scrollTop += (
                activeRect.top
                - navRect.top
                - ((nav.clientHeight - active.clientHeight) / 2)
            );
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', revealActiveSidebarLink);
    } else {
        revealActiveSidebarLink();
    }

    /* ------------------------------------------------------------------ */
    /* Export                                                              */
    /* ------------------------------------------------------------------ */

    PharmaStock.ApiError = ApiError;
    PharmaStock.api = api;
    PharmaStock.getCookie = getCookie;
    PharmaStock.getCsrfToken = getCsrfToken;
    PharmaStock.toast = toast;
    PharmaStock.openModal = openModal;
    PharmaStock.closeModal = closeModal;
    PharmaStock.confirmDialog = confirmDialog;
    PharmaStock.formatNumber = formatNumber;
    PharmaStock.formatMoney = formatMoney;
    PharmaStock.formatDate = formatDate;
    PharmaStock.formatDateTime = formatDateTime;
    PharmaStock.escapeHtml = escapeHtml;
    PharmaStock.debounce = debounce;
    PharmaStock.clearFormErrors = clearFormErrors;
    PharmaStock.showFormErrors = showFormErrors;
    PharmaStock.setButtonLoading = setButtonLoading;
    PharmaStock.renderPagination = renderPagination;
    PharmaStock.emptyState = emptyState;
    PharmaStock.loadingState = loadingState;

    window.PharmaStock = PharmaStock;
})(window, document);

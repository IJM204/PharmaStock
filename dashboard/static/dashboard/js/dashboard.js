// Récupération des statistiques depuis Django REST Framework
async function loadDashboard() {

    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const statisticsSection = document.getElementById('statisticsSection');
    const alertsContainer = document.getElementById('alertsContainer');

    try {

        const response = await fetch('/api/dashboard/overview/', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Votre session a expiré ou votre accès est refusé.');
        }

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des statistiques.');
        }

        const data = await response.json();

        loadingMessage.classList.add('hidden');
        errorMessage.classList.add('hidden');

        displayDashboardDate(data.date);

        displayStatistics(data, statisticsSection);

        displayAlerts(data, alertsContainer);

    } catch (error) {

        loadingMessage.classList.add('hidden');
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');

        console.error('Erreur Dashboard :', error);
    }
}


// Formatage des nombres
function formatNumber(value) {

    const number = Number(value || 0);

    return new Intl.NumberFormat('fr-FR', {
        maximumFractionDigits: 2
    }).format(number);
}


// Formatage des montants
function formatMoney(value) {

    return formatNumber(value) + ' BIF';
}


// Affichage de la date
function displayDashboardDate(dateValue) {

    const dateElement = document.getElementById('dashboardDate');

    if (!dateValue) {
        dateElement.textContent = 'Date indisponible';
        return;
    }

    const date = new Date(dateValue + 'T00:00:00');

    dateElement.textContent = date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}


// Création d'une carte statistique
function createStatCard(title, value, description, icon) {

    const card = document.createElement('article');
    card.className = 'stat-card';

    const top = document.createElement('div');
    top.className = 'stat-card-top';

    const label = document.createElement('span');
    label.className = 'stat-label';
    label.textContent = title;

    const iconElement = document.createElement('div');
    iconElement.className = 'stat-icon';
    iconElement.textContent = icon;

    top.appendChild(label);
    top.appendChild(iconElement);

    const valueElement = document.createElement('div');
    valueElement.className = 'stat-value';
    valueElement.textContent = value;

    const descriptionElement = document.createElement('p');
    descriptionElement.className = 'stat-description';
    descriptionElement.textContent = description;

    card.appendChild(top);
    card.appendChild(valueElement);
    card.appendChild(descriptionElement);

    return card;
}


// Affichage des statistiques disponibles
function displayStatistics(data, container) {

    container.innerHTML = '';

    // UTILISATEURS
    if (data.users) {

        container.appendChild(
            createStatCard(
                'Utilisateurs',
                formatNumber(data.users.total),
                'Nombre total de comptes',
                '👥'
            )
        );

        container.appendChild(
            createStatCard(
                'Utilisateurs actifs',
                formatNumber(data.users.active),
                'Comptes actifs',
                '✓'
            )
        );

        container.appendChild(
            createStatCard(
                'Utilisateurs inactifs',
                formatNumber(data.users.inactive),
                'Comptes désactivés',
                '⊘'
            )
        );

        if (data.users.by_role) {

            Object.entries(data.users.by_role).forEach(([role, total]) => {

                container.appendChild(
                    createStatCard(
                        'Rôle : ' + role,
                        formatNumber(total),
                        'Utilisateurs de ce rôle',
                        '♙'
                    )
                );

            });
        }
    }


    // MEDICAMENTS
    if (data.medicines) {

        container.appendChild(
            createStatCard(
                'Médicaments',
                formatNumber(data.medicines.total),
                'Nombre total de médicaments',
                '💊'
            )
        );

        container.appendChild(
            createStatCard(
                'Médicaments actifs',
                formatNumber(data.medicines.active),
                'Médicaments disponibles',
                '✓'
            )
        );
    }


    // CATEGORIES
    if (data.categories) {

        container.appendChild(
            createStatCard(
                'Catégories',
                formatNumber(data.categories.total),
                'Catégories enregistrées',
                '▤'
            )
        );
    }


    // FOURNISSEURS
    if (data.suppliers) {

        container.appendChild(
            createStatCard(
                'Fournisseurs',
                formatNumber(data.suppliers.total),
                'Nombre total de fournisseurs',
                '♧'
            )
        );

        container.appendChild(
            createStatCard(
                'Fournisseurs actifs',
                formatNumber(data.suppliers.active),
                'Fournisseurs actifs',
                '✓'
            )
        );

        container.appendChild(
            createStatCard(
                'Fournisseurs inactifs',
                formatNumber(data.suppliers.inactive),
                'Fournisseurs désactivés',
                '⊘'
            )
        );
    }


    // STOCK
    if (data.stock) {

        container.appendChild(
            createStatCard(
                'Lots de stock',
                formatNumber(data.stock.total_batches),
                'Nombre total de lots',
                '📦'
            )
        );

        container.appendChild(
            createStatCard(
                'Stock disponible',
                formatNumber(data.stock.total_available),
                'Quantité totale disponible',
                '▣'
            )
        );

        container.appendChild(
            createStatCard(
                'Stock faible',
                formatNumber(data.stock.low_stock_batches),
                'Lots avec quantité faible',
                '⚠'
            )
        );
    }


    // ACHATS
    if (data.purchases) {

        container.appendChild(
            createStatCard(
                'Achats',
                formatNumber(data.purchases.total),
                'Commandes non annulées',
                '🛒'
            )
        );

        container.appendChild(
            createStatCard(
                'Achats en attente',
                formatNumber(data.purchases.pending),
                'Commandes en attente',
                '◷'
            )
        );

        container.appendChild(
            createStatCard(
                'Achats partiels',
                formatNumber(data.purchases.partial),
                'Commandes partiellement reçues',
                '◐'
            )
        );

        container.appendChild(
            createStatCard(
                'Achats reçus',
                formatNumber(data.purchases.received),
                'Commandes entièrement reçues',
                '✓'
            )
        );

        container.appendChild(
            createStatCard(
                'Montant des achats',
                formatMoney(data.purchases.total_amount),
                'Montant total des commandes non annulées',
                '💰'
            )
        );
    }


    // VENTES
    if (data.sales) {

        container.appendChild(
            createStatCard(
                'Ventes du jour',
                formatNumber(data.sales.today_count),
                'Nombre de ventes terminées aujourd’hui',
                '🧾'
            )
        );

        container.appendChild(
            createStatCard(
                'Revenu du jour',
                formatMoney(data.sales.today_revenue),
                'Montant des ventes terminées aujourd’hui',
                '💵'
            )
        );
    }

    if (container.children.length === 0) {

        const message = document.createElement('p');
        message.className = 'message-card';
        message.textContent = 'Aucune statistique disponible pour votre rôle.';

        container.appendChild(message);
    }
}


// Création d'une alerte
function createAlert(type, icon, value, label) {

    const card = document.createElement('div');
    card.className = 'alert-card ' + type;

    const iconElement = document.createElement('div');
    iconElement.className = 'alert-icon';
    iconElement.textContent = icon;

    const info = document.createElement('div');
    info.className = 'alert-info';

    const number = document.createElement('strong');
    number.textContent = formatNumber(value);

    const description = document.createElement('span');
    description.textContent = label;

    info.appendChild(number);
    info.appendChild(description);

    card.appendChild(iconElement);
    card.appendChild(info);

    return card;
}


// Affichage des alertes
function displayAlerts(data, container) {

    container.innerHTML = '';

    let alertCount = 0;

    if (data.stock) {

        container.appendChild(
            createAlert(
                data.stock.low_stock_batches > 0 ? 'warning' : 'success',
                '⚠',
                data.stock.low_stock_batches,
                'Lots avec stock faible'
            )
        );

        alertCount++;
    }

    if (data.expiration) {

        container.appendChild(
            createAlert(
                data.expiration.expired_batches > 0 ? 'danger' : 'success',
                '⛔',
                data.expiration.expired_batches,
                'Lots expirés avec stock restant'
            )
        );

        container.appendChild(
            createAlert(
                data.expiration.expiring_soon_batches > 0 ? 'warning' : 'success',
                '◷',
                data.expiration.expiring_soon_batches,
                'Lots expirant dans les 30 jours'
            )
        );

        alertCount += 2;
    }

    if (alertCount === 0) {

        const message = document.createElement('div');
        message.className = 'message-card';
        message.textContent = 'Aucune alerte disponible pour votre rôle.';

        container.appendChild(message);
    }
}


// MENU MOBILE
document.addEventListener('DOMContentLoaded', function () {

    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {

        menuToggle.addEventListener('click', function () {
            sidebar.classList.toggle('open');
        });
    }

});
"""Variables de contexte communes à toutes les pages HTML."""


PAGE_SECTIONS = {
    'dashboard-page': 'dashboard',
    'medicines-page': 'medicines',
    'medicine-categories-page': 'medicines',
    'suppliers-page': 'suppliers',
    'inventory-page': 'inventory',
    'inventory-movements-page': 'inventory',
    'inventory-low-stock-page': 'inventory',
    'inventory-expired-page': 'inventory',
    'sales-page': 'sales',
    'sale-create-page': 'sales',
    'sale-detail-page': 'sales',
    'purchases-page': 'purchases',
    'purchase-create-page': 'purchases',
    'purchase-detail-page': 'purchases',
    'purchase-receipts-page': 'purchases',
    'accounts-page': 'accounts',
    'profile-page': 'profile',
}


def role_context(request):
    """Expose le rôle et les droits d'affichage à tous les templates."""

    user = getattr(request, 'user', None)
    is_authenticated = bool(user and user.is_authenticated)
    role = getattr(user, 'role', None) if is_authenticated else None

    is_admin = bool(
        is_authenticated
        and (user.is_superuser or role == 'Admin')
    )
    is_stock_manager = is_authenticated and role == 'STOCK_Manager'
    is_pharmacist = is_authenticated and role == 'PHARMASIST'
    is_cashier = is_authenticated and role == 'Cashier'

    resolver_match = getattr(request, 'resolver_match', None)
    url_name = resolver_match.url_name if resolver_match else None

    return {
        'is_admin': is_admin,
        'is_stock_manager': is_stock_manager,
        'is_pharmacist': is_pharmacist,
        'is_cashier': is_cashier,
        'active_nav': PAGE_SECTIONS.get(url_name, ''),
        'can_view_medicines': is_admin or is_stock_manager or is_pharmacist,
        'can_manage_medicines': is_admin or is_stock_manager,
        'can_view_suppliers': is_admin or is_stock_manager,
        'can_manage_suppliers': is_admin or is_stock_manager,
        'can_view_inventory': is_admin or is_stock_manager or is_pharmacist,
        'can_manage_inventory': is_admin or is_stock_manager or is_pharmacist,
        'can_view_sales': is_admin or is_pharmacist or is_cashier,
        'can_create_sales': is_admin or is_pharmacist or is_cashier,
        'can_view_purchases': is_admin or is_stock_manager,
        'can_manage_purchases': is_admin or is_stock_manager,
        'can_manage_users': is_admin,
    }

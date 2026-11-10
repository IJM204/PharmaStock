"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    # Pages HTML
    path('medicines/', include('medicines.page_urls')),
    path('suppliers/', include('suppliers.page_urls')),
    path('inventory/', include('inventory.page_urls')),
    path('sales/', include('sales.page_urls')),
    path('purchases/', include('purchases.page_urls')),
    path('accounts/', include('accounts.page_urls')),

    # API Inventory
    path('api/inventory/', include('inventory.urls')),

    # API Accounts
    path('api/accounts/', include('accounts.urls')),
    # API Medicines
    path('api/medicines/', include('medicines.urls')),
    # API Suppliers
    path('api/suppliers/', include('suppliers.urls')),
    # API Sales
    path('api/', include('sales.urls')),
    # API Purchases
    path('api/purchases/', include('purchases.urls')),
    # API Dashboard
    path('api/dashboard/', include('dashboard.urls')),
]

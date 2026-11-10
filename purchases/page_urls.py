"""URLs des pages HTML du module Achats."""

from django.urls import path

from .page_views import (
    PurchaseCreatePageView,
    PurchaseDetailPageView,
    PurchaseReceiptsPageView,
    PurchasesPageView,
)


urlpatterns = [
    path('', PurchasesPageView.as_view(), name='purchases-page'),
    path('create/', PurchaseCreatePageView.as_view(), name='purchase-create-page'),
    path('receipts/', PurchaseReceiptsPageView.as_view(), name='purchase-receipts-page'),
    path('<int:pk>/', PurchaseDetailPageView.as_view(), name='purchase-detail-page'),
]

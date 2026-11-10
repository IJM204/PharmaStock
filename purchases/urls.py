"""URLs de l'API Achats."""

from rest_framework.routers import DefaultRouter

from .views import PurchaseReceiptViewSet, PurchaseViewSet


router = DefaultRouter()
router.register('purchases', PurchaseViewSet, basename='purchase')
router.register('receipts', PurchaseReceiptViewSet, basename='purchase-receipt')

urlpatterns = router.urls

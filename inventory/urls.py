
from rest_framework.routers import DefaultRouter
from .views import BatchViewSet, StockMovementViewSet

router = DefaultRouter()

router.register('batches', BatchViewSet, basename='batch')
router.register('movements', StockMovementViewSet, basename='movement')

urlpatterns = router.urls


from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from medicines.models import Category, Medicine
from .models import Batch, StockMovement


User = get_user_model()


class InventoryAPITests(APITestCase):

    def setUp(self):

        self.manager = User.objects.create_user(
            username='stock_manager',
            password='TestPassword123',
            role='STOCK_Manager'
        )

        self.cashier = User.objects.create_user(
            username='cashier',
            password='TestPassword123',
            role='Cashier'
        )

        self.category = Category.objects.create(
            name='Antalgiques'
        )

        self.medicine = Medicine.objects.create(
            category=self.category,
            name='Paracetamol',
            generic_name='Paracetamol',
            dosage='500 mg',
            form='TABLET',
            unit_price=1000
        )

        self.batch = Batch.objects.create(
            medicine=self.medicine,
            batch_number='PARA-001',
            quantity_received=100,
            quantity_available=100,
            expiry_date=timezone.localdate() + timedelta(days=365),
            purchase_price=700
        )

        self.register_url = '/api/inventory/movements/register/'

        self.client.force_authenticate(user=self.manager)

    def register_movement(self, data):

        return self.client.post(
            self.register_url,
            data,
            format='json'
        )

    def test_batch_creation_sets_initial_quantities(self):

        response = self.client.post(
            '/api/inventory/batches/',
            {
                'medicine': self.medicine.id,
                'batch_number': 'PARA-002',
                'initial_quantity': 200,
                'expiry_date': (
                    timezone.localdate() + timedelta(days=500)
                ).isoformat(),
                'purchase_price': '700.00'
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        batch = Batch.objects.get(batch_number='PARA-002')

        self.assertEqual(batch.quantity_received, 200)
        self.assertEqual(batch.quantity_available, 200)

    def test_stock_entry(self):

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'IN',
            'quantity': 50,
            'reason': 'Nouvelle livraison'
        })

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.batch.quantity_available, 150)
        self.assertEqual(self.batch.quantity_received, 150)

    def test_stock_exit(self):

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'OUT',
            'quantity': 20,
            'reason': 'Vente'
        })

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.batch.quantity_available, 80)

    def test_exit_with_insufficient_stock(self):

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'OUT',
            'quantity': 200
        })

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.batch.quantity_available, 100)

    def test_adjustment_increase(self):

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'ADJUSTMENT',
            'adjustment_direction': 'INCREASE',
            'quantity': 30,
            'reason': 'Correction après inventaire'
        })

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.batch.quantity_available, 130)

    def test_adjustment_decrease(self):

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'ADJUSTMENT',
            'adjustment_direction': 'DECREASE',
            'quantity': 30,
            'reason': 'Produits manquants'
        })

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.batch.quantity_available, 70)

    def test_adjustment_without_direction(self):

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'ADJUSTMENT',
            'quantity': 10,
            'reason': 'Test'
        })

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.batch.quantity_available, 100)

    def test_adjustment_without_reason(self):

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'ADJUSTMENT',
            'adjustment_direction': 'INCREASE',
            'quantity': 10
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_batch_cannot_be_used_for_exit(self):

        self.batch.expiry_date = timezone.localdate() - timedelta(days=1)
        self.batch.save()

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'OUT',
            'quantity': 10
        })

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.batch.quantity_available, 100)

    def test_expired_batch_cannot_receive_stock(self):

        self.batch.expiry_date = timezone.localdate() - timedelta(days=1)
        self.batch.save()

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'IN',
            'quantity': 10
        })

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.batch.quantity_available, 100)

    def test_cashier_cannot_register_movement(self):

        self.client.force_authenticate(user=self.cashier)

        response = self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'OUT',
            'quantity': 10
        })

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.batch.quantity_available, 100)

    def test_batch_quantity_cannot_be_modified_directly(self):

        response = self.client.patch(
            f'/api/inventory/batches/{self.batch.id}/',
            {'quantity_available': 999},
            format='json'
        )

        self.batch.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.batch.quantity_available, 100)

    def test_movement_history_is_created(self):

        self.register_movement({
            'batch': self.batch.id,
            'movement_type': 'OUT',
            'quantity': 10,
            'reason': 'Sortie de test'
        })

        self.assertEqual(
            StockMovement.objects.filter(batch=self.batch).count(),
            1
        )

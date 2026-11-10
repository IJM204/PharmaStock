from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from medicines.models import Category, Medicine
from inventory.models import Batch, StockMovement
from .models import Sale
from .services import create_sale

User = get_user_model()


class SalesTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='cashier_test',
            password='password123',
            role='Cashier'
        )

        self.category = Category.objects.create(
            name='Antibiotiques'
        )

        self.medicine = Medicine.objects.create(
            category=self.category,
            name='Amoxicilline',
            dosage='500 mg',
            unit_price=Decimal('10000.00')
        )

        today = timezone.localdate()

        self.batch1 = Batch.objects.create(
            medicine=self.medicine,
            batch_number='LOT001',
            quantity_received=10,
            quantity_available=10,
            manufacturing_date=today - timedelta(days=30),
            expiry_date=today + timedelta(days=30),
            purchase_price=Decimal('6000.00')
        )

        self.batch2 = Batch.objects.create(
            medicine=self.medicine,
            batch_number='LOT002',
            quantity_received=20,
            quantity_available=20,
            manufacturing_date=today - timedelta(days=10),
            expiry_date=today + timedelta(days=90),
            purchase_price=Decimal('7000.00')
        )

    # 1. Vérifier la diminution du stock après une vente.
    def test_sale_decreases_stock(self):
        sale = create_sale(
            self.user,
            [{'medicine_id': self.medicine.id, 'quantity': 3}]
        )

        self.batch1.refresh_from_db()

        self.assertEqual(self.batch1.quantity_available, 7)
        self.assertEqual(sale.status, 'COMPLETED')
        self.assertEqual(sale.total_amount, Decimal('30000.00'))

    # 2. Vérifier l'utilisation des lots selon FEFO.
    def test_sale_uses_fefo(self):
        create_sale(
            self.user,
            [{'medicine_id': self.medicine.id, 'quantity': 12}]
        )

        self.batch1.refresh_from_db()
        self.batch2.refresh_from_db()

        self.assertEqual(self.batch1.quantity_available, 0)
        self.assertEqual(self.batch2.quantity_available, 18)

    # 3. Vérifier la création des mouvements de stock.
    def test_sale_creates_stock_movements(self):
        create_sale(
            self.user,
            [{'medicine_id': self.medicine.id, 'quantity': 3}]
        )

        movement = StockMovement.objects.get()

        self.assertEqual(movement.movement_type, 'OUT')
        self.assertEqual(movement.quantity, 3)
        self.assertEqual(movement.performed_by, self.user)

    # 4. Refuser une vente lorsque le stock est insuffisant.
    def test_insufficient_stock_is_rejected(self):
        with self.assertRaises(ValidationError):
            create_sale(
                self.user,
                [{'medicine_id': self.medicine.id, 'quantity': 100}]
            )

        self.batch1.refresh_from_db()

        self.assertEqual(self.batch1.quantity_available, 10)
        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(StockMovement.objects.count(), 0)

    # 5. Vérifier qu'un lot expiré n'est pas utilisé.
    def test_expired_batch_is_not_used(self):
        self.batch1.expiry_date = (
            timezone.localdate() - timedelta(days=1)
        )
        self.batch1.save()

        create_sale(
            self.user,
            [{'medicine_id': self.medicine.id, 'quantity': 3}]
        )

        self.batch1.refresh_from_db()
        self.batch2.refresh_from_db()

        self.assertEqual(self.batch1.quantity_available, 10)
        self.assertEqual(self.batch2.quantity_available, 17)

    # 6. Refuser une vente à perte.
    def test_sale_at_a_loss_is_rejected(self):
        self.batch1.purchase_price = Decimal('12000.00')
        self.batch1.save()

        with self.assertRaises(ValidationError):
            create_sale(
                self.user,
                [{'medicine_id': self.medicine.id, 'quantity': 3}]
            )

        self.batch1.refresh_from_db()

        self.assertEqual(self.batch1.quantity_available, 10)
        self.assertEqual(Sale.objects.count(), 0)

    # 7. Vérifier qu'un caissier peut créer une vente via l'API.
    def test_cashier_can_create_sale_through_api(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            '/api/sales/create/',
            {
                'items': [
                    {
                        'medicine_id': self.medicine.id,
                        'quantity': 2
                    }
                ]
            },
            format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Sale.objects.count(), 1)

    # 8. Empêcher un caissier de modifier le prix de vente.
    def test_cashier_cannot_change_medicine_sale_price(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.patch(
            f'/api/medicines/medicines/{self.medicine.id}/',
            {'unit_price': '500.00'},
            format='json'
        )

        self.assertEqual(response.status_code, 403)

        self.medicine.refresh_from_db()

        self.assertEqual(
            self.medicine.unit_price,
            Decimal('10000.00')
        )

    # 9. Refuser une vente si un autre lot disponible est plus cher.
    def test_sale_is_rejected_if_another_available_batch_is_more_expensive(self):
        self.batch1.purchase_price = Decimal('6000.00')
        self.batch1.save()

        self.batch2.purchase_price = Decimal('12000.00')
        self.batch2.save()

        with self.assertRaises(ValidationError):
            create_sale(
                self.user,
                [{'medicine_id': self.medicine.id, 'quantity': 3}]
            )

        self.batch1.refresh_from_db()
        self.batch2.refresh_from_db()

        self.assertEqual(self.batch1.quantity_available, 10)
        self.assertEqual(self.batch2.quantity_available, 20)

        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(StockMovement.objects.count(), 0)
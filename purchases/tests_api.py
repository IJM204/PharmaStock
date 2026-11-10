"""Tests de l'API Achats et de la réception atomique."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from inventory.models import Batch, StockMovement
from medicines.models import Category, Medicine
from suppliers.models import Supplier

from .models import Purchase, PurchaseItem, PurchaseReceipt


User = get_user_model()


class PurchaseAPITests(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='purchase_api_admin',
            password='TestPassword123!',
            role='Admin',
        )
        self.stock_manager = User.objects.create_user(
            username='purchase_api_stock',
            password='TestPassword123!',
            role='STOCK_Manager',
        )
        self.pharmacist = User.objects.create_user(
            username='purchase_api_pharmacist',
            password='TestPassword123!',
            role='PHARMASIST',
        )
        self.cashier = User.objects.create_user(
            username='purchase_api_cashier',
            password='TestPassword123!',
            role='Cashier',
        )

        self.category = Category.objects.create(name='Achats')
        self.medicine = Medicine.objects.create(
            category=self.category,
            name='Amoxicilline',
            dosage='500 mg',
            unit_price='1500.00',
        )
        self.other_medicine = Medicine.objects.create(
            category=self.category,
            name='Paracetamol',
            dosage='500 mg',
            unit_price='1000.00',
        )
        self.supplier = Supplier.objects.create(
            name='Fournisseur API',
            contact_person='Alice',
            phone='0102030405',
            email='api@example.com',
            address='Adresse',
        )
        self.today = timezone.localdate()

    def make_purchase(self, quantity=10, medicine=None):
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=medicine or self.medicine,
            quantity_ordered=quantity,
            unit_price='1000.00',
            manufacturing_date=self.today - timedelta(days=30),
            expiry_date=self.today + timedelta(days=365),
        )
        return purchase, item

    def receive_payload(self, item, quantity, **overrides):
        payload = {
            'items': [
                {
                    'purchase_item': item.id,
                    'quantity': quantity,
                    'batch_number': overrides.pop(
                        'batch_number',
                        f'LOT-API-{item.id}',
                    ),
                    'manufacturing_date': str(
                        overrides.pop(
                            'manufacturing_date',
                            self.today - timedelta(days=30),
                        )
                    ),
                    'expiry_date': str(
                        overrides.pop(
                            'expiry_date',
                            self.today + timedelta(days=365),
                        )
                    ),
                    'notes': overrides.pop('notes', ''),
                }
            ]
        }
        return payload

    def test_anonymous_user_cannot_list_purchases(self):
        response = self.client.get('/api/purchases/purchases/')

        self.assertIn(response.status_code, [401, 403])

    def test_cashier_and_pharmacist_cannot_access_purchases(self):
        for user in (self.cashier, self.pharmacist):
            self.client.force_authenticate(user=user)
            response = self.client.get('/api/purchases/purchases/')
            self.assertEqual(response.status_code, 403)

    def test_stock_manager_can_list_purchases(self):
        self.make_purchase()

        self.client.force_authenticate(user=self.stock_manager)
        response = self.client.get('/api/purchases/purchases/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_create_purchase_with_items(self):
        self.client.force_authenticate(user=self.stock_manager)

        response = self.client.post(
            '/api/purchases/purchases/',
            {
                'supplier': self.supplier.id,
                'expected_date': str(self.today + timedelta(days=7)),
                'notes': 'Commande test',
                'items': [
                    {
                        'medicine': self.medicine.id,
                        'quantity_ordered': 12,
                        'unit_price': '1000.00',
                        'manufacturing_date': str(
                            self.today - timedelta(days=30)
                        ),
                        'expiry_date': str(self.today + timedelta(days=365)),
                        'notes': 'Lot A',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'PENDING')
        self.assertEqual(response.data['total_amount'], '12000.00')
        self.assertEqual(len(response.data['items']), 1)
        self.assertEqual(response.data['items'][0]['medicine_name'], 'Amoxicilline')
        self.assertEqual(PurchaseItem.objects.count(), 1)

    def test_create_purchase_rejects_inactive_medicine(self):
        self.medicine.is_active = False
        self.medicine.save(update_fields=['is_active'])
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            '/api/purchases/purchases/',
            {
                'supplier': self.supplier.id,
                'items': [
                    {
                        'medicine': self.medicine.id,
                        'quantity_ordered': 1,
                        'unit_price': '1000.00',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Purchase.objects.count(), 0)

    def test_create_purchase_rejects_duplicate_medicine(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            '/api/purchases/purchases/',
            {
                'supplier': self.supplier.id,
                'items': [
                    {
                        'medicine': self.medicine.id,
                        'quantity_ordered': 1,
                        'unit_price': '1000.00',
                    },
                    {
                        'medicine': self.medicine.id,
                        'quantity_ordered': 2,
                        'unit_price': '1000.00',
                    },
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Purchase.objects.count(), 0)

    def test_full_receipt_creates_batch_and_stock_movement(self):
        purchase, item = self.make_purchase(quantity=8)
        self.client.force_authenticate(user=self.stock_manager)

        response = self.client.post(
            f'/api/purchases/purchases/{purchase.id}/receive/',
            self.receive_payload(item, 8),
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'RECEIVED')
        self.assertEqual(response.data['items'][0]['quantity_received'], 8)
        self.assertEqual(response.data['receipts'][0]['status'], 'CONFIRMED')

        item.refresh_from_db()
        self.assertEqual(item.quantity_received, 8)
        self.assertEqual(Batch.objects.count(), 1)
        batch = Batch.objects.get()
        self.assertEqual(batch.quantity_received, 8)
        self.assertEqual(batch.quantity_available, 8)
        self.assertEqual(batch.medicine, self.medicine)
        movement = StockMovement.objects.get()
        self.assertEqual(movement.movement_type, 'IN')
        self.assertEqual(movement.quantity, 8)
        self.assertEqual(movement.batch, batch)

    def test_partial_then_full_receipt(self):
        purchase, item = self.make_purchase(quantity=10)
        self.client.force_authenticate(user=self.stock_manager)

        first = self.client.post(
            f'/api/purchases/purchases/{purchase.id}/receive/',
            self.receive_payload(item, 4, batch_number='LOT-PARTIEL-1'),
            format='json',
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data['status'], 'PARTIAL')

        item.refresh_from_db()
        second = self.client.post(
            f'/api/purchases/purchases/{purchase.id}/receive/',
            self.receive_payload(item, 6, batch_number='LOT-PARTIEL-2'),
            format='json',
        )
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.data['status'], 'RECEIVED')

        item.refresh_from_db()
        self.assertEqual(item.quantity_received, 10)
        self.assertEqual(Batch.objects.count(), 2)
        self.assertEqual(PurchaseReceipt.objects.count(), 2)

    def test_over_receipt_is_rejected(self):
        purchase, item = self.make_purchase(quantity=5)
        self.client.force_authenticate(user=self.stock_manager)

        response = self.client.post(
            f'/api/purchases/purchases/{purchase.id}/receive/',
            self.receive_payload(item, 6),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        item.refresh_from_db()
        self.assertEqual(item.quantity_received, 0)
        self.assertEqual(Batch.objects.count(), 0)
        self.assertEqual(PurchaseReceipt.objects.count(), 0)

    def test_receive_rolls_back_all_items_on_failure(self):
        purchase, first_item = self.make_purchase(quantity=3)
        second_item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.other_medicine,
            quantity_ordered=2,
            unit_price='1000.00',
            manufacturing_date=self.today - timedelta(days=30),
            expiry_date=self.today + timedelta(days=365),
        )
        self.client.force_authenticate(user=self.stock_manager)

        response = self.client.post(
            f'/api/purchases/purchases/{purchase.id}/receive/',
            {
                'items': [
                    {
                        'purchase_item': first_item.id,
                        'quantity': 3,
                        'batch_number': 'LOT-ROLLBACK-1',
                        'manufacturing_date': str(
                            self.today - timedelta(days=30)
                        ),
                        'expiry_date': str(self.today + timedelta(days=365)),
                    },
                    {
                        'purchase_item': second_item.id,
                        'quantity': 2,
                        'batch_number': 'LOT-ROLLBACK-2',
                        'manufacturing_date': str(
                            self.today - timedelta(days=30)
                        ),
                        'expiry_date': str(self.today - timedelta(days=1)),
                    },
                ]
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        purchase.refresh_from_db()
        first_item.refresh_from_db()
        second_item.refresh_from_db()
        self.assertEqual(purchase.status, 'PENDING')
        self.assertEqual(first_item.quantity_received, 0)
        self.assertEqual(second_item.quantity_received, 0)
        self.assertEqual(Batch.objects.count(), 0)
        self.assertEqual(StockMovement.objects.count(), 0)
        self.assertEqual(PurchaseReceipt.objects.count(), 0)

    def test_receive_rejects_item_from_another_purchase(self):
        purchase, _ = self.make_purchase(quantity=3)
        _, other_item = self.make_purchase(quantity=3)
        self.client.force_authenticate(user=self.stock_manager)

        response = self.client.post(
            f'/api/purchases/purchases/{purchase.id}/receive/',
            self.receive_payload(other_item, 1),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(PurchaseReceipt.objects.count(), 0)

    def test_receipt_history_can_be_filtered_by_purchase(self):
        purchase, item = self.make_purchase(quantity=4)
        self.client.force_authenticate(user=self.stock_manager)
        self.client.post(
            f'/api/purchases/purchases/{purchase.id}/receive/',
            self.receive_payload(item, 4),
            format='json',
        )

        response = self.client.get(
            f'/api/purchases/receipts/?purchase={purchase.id}'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['purchase_id'], purchase.id)
        self.assertEqual(response.data[0]['medicine_name'], 'Amoxicilline')
        self.assertEqual(response.data[0]['status'], 'CONFIRMED')

    def test_cashier_cannot_receive_purchase(self):
        purchase, item = self.make_purchase(quantity=4)
        self.client.force_authenticate(user=self.cashier)

        response = self.client.post(
            f'/api/purchases/purchases/{purchase.id}/receive/',
            self.receive_payload(item, 4),
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(PurchaseReceipt.objects.count(), 0)

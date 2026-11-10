"""Tests des pages HTML du module Achats."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from medicines.models import Category, Medicine
from suppliers.models import Supplier

from .models import Purchase, PurchaseItem


User = get_user_model()


class PurchasePageTests(TestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='purchase_page_admin',
            password='TestPassword123!',
            role='Admin',
        )
        self.stock_manager = User.objects.create_user(
            username='purchase_page_stock',
            password='TestPassword123!',
            role='STOCK_Manager',
        )
        self.pharmacist = User.objects.create_user(
            username='purchase_page_pharmacist',
            password='TestPassword123!',
            role='PHARMASIST',
        )
        self.cashier = User.objects.create_user(
            username='purchase_page_cashier',
            password='TestPassword123!',
            role='Cashier',
        )
        self.category = Category.objects.create(name='Achats pages')
        self.medicine = Medicine.objects.create(
            category=self.category,
            name='Amoxicilline',
            dosage='500 mg',
            unit_price='1500.00',
        )
        self.supplier = Supplier.objects.create(
            name='Fournisseur pages',
            contact_person='Alice',
            phone='0102030405',
            email='pages@example.com',
            address='Adresse',
        )
        self.purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin,
        )
        self.item = PurchaseItem.objects.create(
            purchase=self.purchase,
            medicine=self.medicine,
            quantity_ordered=10,
            unit_price='1000.00',
            manufacturing_date=timezone.localdate() - timedelta(days=30),
            expiry_date=timezone.localdate() + timedelta(days=365),
        )

    def test_anonymous_user_is_redirected_to_login(self):
        response = self.client.get(reverse('purchases-page'))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('dashboard-login'), response.url)

    def test_admin_can_access_purchase_pages(self):
        self.client.force_login(self.admin)

        list_response = self.client.get(reverse('purchases-page'))
        create_response = self.client.get(reverse('purchase-create-page'))
        detail_response = self.client.get(
            reverse('purchase-detail-page', args=[self.purchase.id])
        )
        receipts_response = self.client.get(reverse('purchase-receipts-page'))

        self.assertEqual(list_response.status_code, 200)
        self.assertContains(list_response, 'Commandes fournisseurs')
        self.assertEqual(create_response.status_code, 200)
        self.assertContains(create_response, 'Créer une commande fournisseur')
        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(detail_response, f'Achat #{self.purchase.id}')
        self.assertEqual(receipts_response.status_code, 200)
        self.assertContains(receipts_response, 'Historique des réceptions')

    def test_stock_manager_can_access_purchase_pages(self):
        self.client.force_login(self.stock_manager)

        response = self.client.get(reverse('purchases-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Commandes fournisseurs')

    def test_pharmacist_cannot_access_purchase_pages(self):
        self.client.force_login(self.pharmacist)

        response = self.client.get(reverse('purchases-page'))

        self.assertEqual(response.status_code, 403)

    def test_cashier_cannot_access_purchase_pages(self):
        self.client.force_login(self.cashier)

        response = self.client.get(reverse('purchases-page'))

        self.assertEqual(response.status_code, 403)

    def test_unknown_purchase_detail_returns_404(self):
        self.client.force_login(self.admin)

        response = self.client.get(
            reverse('purchase-detail-page', args=[999999])
        )

        self.assertEqual(response.status_code, 404)

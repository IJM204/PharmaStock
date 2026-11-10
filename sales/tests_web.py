"""Tests des pages HTML du module Ventes."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Sale


User = get_user_model()


class SalesPageTests(TestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='sales_admin',
            password='TestPassword123!',
            role='Admin',
        )
        self.stock_manager = User.objects.create_user(
            username='sales_stock',
            password='TestPassword123!',
            role='STOCK_Manager',
        )
        self.pharmacist = User.objects.create_user(
            username='sales_pharmacist',
            password='TestPassword123!',
            role='PHARMASIST',
        )
        self.cashier = User.objects.create_user(
            username='sales_cashier',
            password='TestPassword123!',
            role='Cashier',
        )
        self.other_cashier = User.objects.create_user(
            username='sales_cashier_other',
            password='TestPassword123!',
            role='Cashier',
        )

        self.own_sale = Sale.objects.create(
            sold_by=self.cashier,
            total_amount='5000.00',
        )
        self.other_sale = Sale.objects.create(
            sold_by=self.other_cashier,
            total_amount='7000.00',
        )

    def test_anonymous_user_is_redirected_to_login(self):
        response = self.client.get(reverse('sales-page'))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('dashboard-login'), response.url)

    def test_admin_can_access_sales_page(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse('sales-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Historique des ventes')
        self.assertContains(response, 'Nouvelle vente')

    def test_pharmacist_can_access_sales_page(self):
        self.client.force_login(self.pharmacist)

        response = self.client.get(reverse('sales-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Historique des ventes')

    def test_cashier_can_access_sales_page(self):
        self.client.force_login(self.cashier)

        response = self.client.get(reverse('sales-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Historique des ventes')

    def test_stock_manager_cannot_access_sales_page(self):
        self.client.force_login(self.stock_manager)

        response = self.client.get(reverse('sales-page'))

        self.assertEqual(response.status_code, 403)

    def test_cashier_can_access_create_sale_page(self):
        self.client.force_login(self.cashier)

        response = self.client.get(reverse('sale-create-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Enregistrer une vente')

    def test_cashier_can_access_own_sale_detail(self):
        self.client.force_login(self.cashier)

        response = self.client.get(
            reverse('sale-detail-page', args=[self.own_sale.id])
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'Vente #{self.own_sale.id}')

    def test_cashier_cannot_access_another_cashier_sale_detail(self):
        self.client.force_login(self.cashier)

        response = self.client.get(
            reverse('sale-detail-page', args=[self.other_sale.id])
        )

        self.assertEqual(response.status_code, 403)

    def test_admin_can_access_any_sale_detail(self):
        self.client.force_login(self.admin)

        response = self.client.get(
            reverse('sale-detail-page', args=[self.other_sale.id])
        )

        self.assertEqual(response.status_code, 200)

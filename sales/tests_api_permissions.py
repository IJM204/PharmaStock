"""Tests du filtrage serveur des ventes par rôle."""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Sale


User = get_user_model()


class SalePermissionTests(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='sale_perm_admin',
            password='TestPassword123!',
            role='Admin',
        )
        self.pharmacist = User.objects.create_user(
            username='sale_perm_pharmacist',
            password='TestPassword123!',
            role='PHARMASIST',
        )
        self.cashier = User.objects.create_user(
            username='sale_perm_cashier',
            password='TestPassword123!',
            role='Cashier',
        )
        self.other_cashier = User.objects.create_user(
            username='sale_perm_other',
            password='TestPassword123!',
            role='Cashier',
        )

        self.cashier_sale = Sale.objects.create(
            sold_by=self.cashier,
            total_amount='1000.00',
        )
        self.other_sale = Sale.objects.create(
            sold_by=self.other_cashier,
            total_amount='2000.00',
        )

    def test_cashier_only_sees_own_sales(self):
        self.client.force_authenticate(user=self.cashier)

        response = self.client.get('/api/sales/')

        self.assertEqual(response.status_code, 200)
        ids = [sale['id'] for sale in response.data]
        self.assertEqual(ids, [self.cashier_sale.id])

    def test_admin_sees_all_sales(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get('/api/sales/')

        self.assertEqual(response.status_code, 200)
        ids = {sale['id'] for sale in response.data}
        self.assertEqual(ids, {self.cashier_sale.id, self.other_sale.id})

    def test_pharmacist_sees_all_sales(self):
        self.client.force_authenticate(user=self.pharmacist)

        response = self.client.get('/api/sales/')

        self.assertEqual(response.status_code, 200)
        ids = {sale['id'] for sale in response.data}
        self.assertEqual(ids, {self.cashier_sale.id, self.other_sale.id})

    def test_cashier_cannot_retrieve_another_sale(self):
        self.client.force_authenticate(user=self.cashier)

        response = self.client.get(f'/api/sales/{self.other_sale.id}/')

        self.assertEqual(response.status_code, 404)

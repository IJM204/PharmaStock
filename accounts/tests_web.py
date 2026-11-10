"""Tests des pages HTML du module Comptes."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse


User = get_user_model()


class AccountsPageTests(TestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='accounts_page_admin',
            password='TestPassword123!',
            role='Admin',
        )
        self.stock_manager = User.objects.create_user(
            username='accounts_page_stock',
            password='TestPassword123!',
            role='STOCK_Manager',
        )
        self.pharmacist = User.objects.create_user(
            username='accounts_page_pharmacist',
            password='TestPassword123!',
            role='PHARMASIST',
        )
        self.cashier = User.objects.create_user(
            username='accounts_page_cashier',
            password='TestPassword123!',
            role='Cashier',
        )

    def test_anonymous_user_is_redirected_to_login(self):
        accounts_response = self.client.get(reverse('accounts-page'))
        profile_response = self.client.get(reverse('profile-page'))

        self.assertEqual(accounts_response.status_code, 302)
        self.assertIn(reverse('dashboard-login'), accounts_response.url)
        self.assertEqual(profile_response.status_code, 302)
        self.assertIn(reverse('dashboard-login'), profile_response.url)

    def test_admin_can_access_accounts_page(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse('accounts-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Gestion des utilisateurs')
        self.assertContains(response, 'Nouvel utilisateur')

    def test_non_admin_cannot_access_accounts_page(self):
        for user in (self.stock_manager, self.pharmacist, self.cashier):
            self.client.force_login(user)
            response = self.client.get(reverse('accounts-page'))
            self.assertEqual(response.status_code, 403)

    def test_all_roles_can_access_profile_page(self):
        for user in (
            self.admin,
            self.stock_manager,
            self.pharmacist,
            self.cashier,
        ):
            self.client.force_login(user)
            response = self.client.get(reverse('profile-page'))
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'Informations personnelles')
            self.assertContains(response, 'Modifier mes informations')

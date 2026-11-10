"""Tests de la gestion administrative des comptes et du profil."""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase


User = get_user_model()


class AccountsAdminAPITests(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='accounts_admin',
            password='AdminPassword123!',
            role='Admin',
        )
        self.cashier = User.objects.create_user(
            username='accounts_cashier',
            password='CashierPassword123!',
            role='Cashier',
        )
        self.target = User.objects.create_user(
            username='accounts_target',
            password='TargetPassword123!',
            role='PHARMASIST',
        )

    def test_anonymous_cannot_manage_users(self):
        response = self.client.get('/api/accounts/users/')

        self.assertIn(response.status_code, [401, 403])

    def test_non_admin_cannot_create_or_update_users(self):
        self.client.force_authenticate(user=self.cashier)

        list_response = self.client.get('/api/accounts/users/')
        create_response = self.client.post(
            '/api/accounts/users/create/',
            {
                'username': 'forbidden_user',
                'password': 'Password123!',
                'role': 'Cashier',
            },
            format='json',
        )
        detail_response = self.client.patch(
            f'/api/accounts/users/{self.target.id}/',
            {'is_active': False},
            format='json',
        )

        self.assertEqual(list_response.status_code, 403)
        self.assertEqual(create_response.status_code, 403)
        self.assertEqual(detail_response.status_code, 403)

    def test_admin_can_create_user_with_role(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            '/api/accounts/users/create/',
            {
                'username': 'new_cashier',
                'email': 'cashier@example.com',
                'first_name': 'Nina',
                'last_name': 'Kaze',
                'role': 'Cashier',
                'is_active': True,
                'password': 'NewPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username='new_cashier')
        self.assertEqual(user.role, 'Cashier')
        self.assertTrue(user.check_password('NewPassword123!'))
        self.assertTrue(user.is_active)
        self.assertNotIn('password', response.data)

    def test_admin_can_update_user_role_and_status(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            f'/api/accounts/users/{self.target.id}/',
            {
                'role': 'STOCK_Manager',
                'is_active': False,
                'email': 'updated@example.com',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertEqual(self.target.role, 'STOCK_Manager')
        self.assertFalse(self.target.is_active)
        self.assertEqual(self.target.email, 'updated@example.com')

    def test_admin_can_reset_user_password(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            f'/api/accounts/users/{self.target.id}/',
            {'password': 'ResetPassword123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertTrue(self.target.check_password('ResetPassword123!'))

    def test_admin_cannot_deactivate_own_account(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            f'/api/accounts/users/{self.admin.id}/',
            {'is_active': False},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_admin_cannot_change_own_role(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            f'/api/accounts/users/{self.admin.id}/',
            {'role': 'Cashier'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.role, 'Admin')

    def test_last_active_admin_cannot_be_demoted_by_superuser(self):
        superuser = User.objects.create_superuser(
            username='accounts_superuser',
            password='SuperPassword123!',
            role='PHARMASIST',
        )
        self.client.force_authenticate(user=superuser)

        response = self.client.patch(
            f'/api/accounts/users/{self.admin.id}/',
            {'role': 'Cashier'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.role, 'Admin')

    def test_profile_can_be_updated_without_changing_role(self):
        self.client.force_authenticate(user=self.cashier)

        response = self.client.patch(
            '/api/accounts/profile/',
            {
                'email': 'newmail@example.com',
                'first_name': 'Nina',
                'last_name': 'Kaze',
                'role': 'Admin',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.cashier.refresh_from_db()
        self.assertEqual(self.cashier.email, 'newmail@example.com')
        self.assertEqual(self.cashier.first_name, 'Nina')
        self.assertEqual(self.cashier.role, 'Cashier')

    def test_profile_password_change_is_hashed(self):
        self.client.force_authenticate(user=self.cashier)

        response = self.client.patch(
            '/api/accounts/profile/',
            {'password': 'ChangedPassword123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.cashier.refresh_from_db()
        self.assertTrue(self.cashier.check_password('ChangedPassword123!'))

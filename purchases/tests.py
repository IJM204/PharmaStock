from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.contrib.auth import get_user_model

from accounts.models import User
from medicines.models import Medicine, Category
from suppliers.models import Supplier
from purchases.models import Purchase, PurchaseItem, PurchaseReceipt


User = get_user_model()


class PurchaseTests(TestCase):
    """Tests pour l'application purchases."""

    def setUp(self):
        """Configuration initiale pour chaque test."""
        # Création d'un utilisateur administrateur (gère les conflits de username existants)
        try:
            self.admin_user = User.objects.get(username='admin')
        except User.DoesNotExist:
            self.admin_user = User.objects.create_user(
                username='admin', password='TestPassword123', role='Admin'
            )

        # Création d'un utilisateur caissier (gère les conflits de username existants)
        try:
            self.cashier = User.objects.get(username='cashier')
        except User.DoesNotExist:
            self.cashier = User.objects.create_user(
                username='cashier', password='TestPassword123', role='Cashier'
            )

        # Création de catégories et de médicaments (utilise get_or_create)
        self.category1, _ = Category.objects.get_or_create(name='Antalgiques')
        self.category2, _ = Category.objects.get_or_create(name='Anti-inflammatoires')
        self.medicine1, _ = Medicine.objects.get_or_create(
            category=self.category1,
            name='Paracetamol',
            generic_name='Paracetamol',
            dosage='500 mg',
            form='TABLET',
            unit_price=1000,
            is_active=True
        )
        self.medicine2, _ = Medicine.objects.get_or_create(
            category=self.category2,
            name='Ibuprofene',
            generic_name='Ibuprofene',
            dosage='400 mg',
            form='TABLET',
            unit_price=1500,
            is_active=True
        )

        # Création d'un fournisseur (utilise get_or_create)
        self.supplier, _ = Supplier.objects.get_or_create(
            name='PharmaSupply',
            contact_person='Jean Dupont',
            phone='0123456789',
            email='contact@pharmasupply.fr',
            address='1 Rue de la Pharmacie',
            is_active=True
        )

    def test_purchase_creation(self):
        """Test 1 : Création d'une commande."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
            expected_date=timezone.now().date() + timezone.timedelta(days=30),
        )
        self.assertEqual(Purchase.objects.count(), 1)
        self.assertEqual(purchase.status, 'PENDING')
        self.assertEqual(purchase.supplier, self.supplier)
        self.assertEqual(purchase.ordered_by, self.admin_user)

    def test_purchase_total_amount_calculation(self):
        """Test 2 : Calcul automatique du montant total avec deux médicaments."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        # Création d'articles de commande avec DES MÉDICAMENTS DIFFÉRENTS
        # (contrainte unique_together = ['purchase', 'medicine'])
        item1 = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=5,
            unit_price='10.00'
        )
        item2 = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine2,
            quantity_ordered=3,
            unit_price='15.00'
        )
        # Le total devrait être : (5 * 10) + (3 * 15) = 50 + 45 = 95
        purchase.refresh_from_db()
        expected_total = 5 * 10 + 3 * 15
        self.assertEqual(purchase.total_amount, expected_total)

    def test_purchaseitem_creation(self):
        """Test 3 : Création d'un article de commande."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=10,
            unit_price='5.50'
        )
        self.assertEqual(item.quantity_ordered, 10)
        self.assertEqual(item.unit_price, 5.50)
        self.assertEqual(item.medicine, self.medicine1)
        self.assertEqual(item.purchase, purchase)

    def test_purchaseitem_validations(self):
        """Test 4 : Validations sur PurchaseItem."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        # Test avec quantité invalide
        item = PurchaseItem(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=0,  # Should fail
            unit_price='5.00'
        )
        with self.assertRaises(ValidationError):
            item.full_clean()

        # Test avec prix négatif
        item2 = PurchaseItem(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=5,
            unit_price='-10.00'  # Should fail
        )
        with self.assertRaises(ValidationError):
            item2.full_clean()

        # Test avec médicament inactif
        self.medicine1.is_active = False
        self.medicine1.save()
        item3 = PurchaseItem(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=5,
            unit_price='5.00'
        )
        with self.assertRaises(ValidationError):
            item3.full_clean()
        # Remettre actif
        self.medicine1.is_active = True
        self.medicine1.save()

    def test_purchaseitem_quantity_received_validation(self):
        """Test 5 : Quantité reçue cumulée ne doit pas dépasser quantité commandée."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=10,
            unit_price='5.00'
        )
        # Définir directement quantity_received pour tester la validation du modèle
        item.quantity_received = 15
        with self.assertRaises(ValidationError):
            item.full_clean()

    def test_purchase_receipt_creation_partial(self):
        """Test 6 : Création d'une réception partielle."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=50,
            unit_price='10.00'
        )
        # Création d'une réception en brouillon
        receipt = PurchaseReceipt.objects.create(
            purchase_item=item,
            quantity=30,
            received_by=self.admin_user,
            status='DRAFT',
            batch_number='TEST-LOT-001',
            manufacturing_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
        )
        self.assertEqual(receipt.status, 'DRAFT')
        self.assertEqual(item.quantity_received, 0)  # Pas encore traité

    def test_purchase_receipt_process_receipt_partial(self):
        """Test 7 : Traitement de réception partielle."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=50,
            unit_price='10.00'
        )
        # Création et traitement de réception
        receipt = PurchaseReceipt.objects.create(
            purchase_item=item,
            quantity=30,
            received_by=self.admin_user,
            status='DRAFT',
            batch_number='TEST-LOT-002',
            manufacturing_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
        )
        # Traitement de la réception
        batch = receipt.process_receipt()
        item.refresh_from_db()
        purchase.refresh_from_db()
        receipt.refresh_from_db()
        # Vérification des résultats
        self.assertIsNotNone(batch)
        self.assertEqual(item.quantity_received, 30)
        # Statut de l'achat devrait être PARTIAL (30 sur 50)
        self.assertEqual(purchase.status, 'PARTIAL')
        # Statut du reçu devrait être CONFIRMED
        self.assertEqual(receipt.status, 'CONFIRMED')

    def test_purchase_receipt_process_receipt_full(self):
        """Test 8 : réception complète."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=50,
            unit_price='10.00'
        )
        # Réception complète
        receipt = PurchaseReceipt.objects.create(
            purchase_item=item,
            quantity=50,
            received_by=self.admin_user,
            status='DRAFT',
            batch_number='TEST-LOT-003',
            manufacturing_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
        )
        batch = receipt.process_receipt()
        item.refresh_from_db()
        purchase.refresh_from_db()
        receipt.refresh_from_db()
        self.assertEqual(item.quantity_received, 50)
        self.assertEqual(purchase.status, 'RECEIVED')
        self.assertEqual(receipt.status, 'CONFIRMED')

    def test_purchase_receipt_duplicate_processing(self):
        """Test 9 : Refus du traitement double d'une réception."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=50,
            unit_price='10.00'
        )
        receipt = PurchaseReceipt.objects.create(
            purchase_item=item,
            quantity=30,
            received_by=self.admin_user,
            status='DRAFT',
            batch_number='TEST-LOT-004',
            manufacturing_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
        )
        # Premier traitement - devrait réussir
        batch1 = receipt.process_receipt()
        receipt.refresh_from_db()
        self.assertEqual(receipt.status, 'CONFIRMED')
        # Deuxième traitement sur le même reçu confirmé - devrait échouer
        with self.assertRaises(ValidationError):
            receipt.process_receipt()

    def test_purchase_receipt_cancelled_purchase(self):
        """Test 10 : Réception d'un achat annulé refusée."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
            status='CANCELLED',
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=50,
            unit_price='10.00'
        )
        receipt = PurchaseReceipt.objects.create(
            purchase_item=item,
            quantity=30,
            received_by=self.admin_user,
            status='DRAFT',
            batch_number='TEST-LOT-005',
            manufacturing_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
        )
        # Tentative de traitement - devrait échouer
        with self.assertRaises(ValidationError):
            receipt.process_receipt()

    def test_purchase_receipt_confirmation_protection(self):
        """Test 11 : Interdiction de modifier une réception confirmée."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=50,
            unit_price='10.00'
        )
        receipt = PurchaseReceipt.objects.create(
            purchase_item=item,
            quantity=30,
            received_by=self.admin_user,
            status='DRAFT',
            batch_number='TEST-LOT-006',
            manufacturing_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
        )
        # Traitement pour confirmer
        receipt.process_receipt()
        # Essayer de modifier - devrait échouer
        receipt.quantity = 50
        with self.assertRaises(ValidationError):
            receipt.save()

    def test_purchase_receipt_deletion_protection(self):
        """Test 12 : Interdiction de supprimer une réception confirmée."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=50,
            unit_price='10.00'
        )
        receipt = PurchaseReceipt.objects.create(
            purchase_item=item,
            quantity=30,
            received_by=self.admin_user,
            status='DRAFT',
            batch_number='TEST-LOT-007',
            manufacturing_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
        )
        # Traitement pour confirmer
        receipt.process_receipt()
        # Essayer de supprimer - devrait échouer via le modèle
        with self.assertRaises(ValidationError):
            receipt.delete()

    def test_purchase_status_transitions(self):
        """Test 13 : Vérification des transitions de statut."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=50,
            unit_price='10.00'
        )
        # Initialement PENDING
        self.assertEqual(purchase.status, 'PENDING')
        # Après réception partielle
        receipt = PurchaseReceipt.objects.create(
            purchase_item=item,
            quantity=30,
            received_by=self.admin_user,
            status='DRAFT',
            batch_number='TEST-LOT-010',
            manufacturing_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
        )
        receipt.process_receipt()
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, 'PARTIAL')
        # Après réception complète
        receipt2 = PurchaseReceipt.objects.create(
            purchase_item=item,
            quantity=20,
            received_by=self.admin_user,
            status='DRAFT',
            batch_number='TEST-LOT-011',
            manufacturing_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
        )
        receipt2.process_receipt()
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, 'RECEIVED')

    def test_purchase_item_cannot_exceed_ordered(self):
        """Test 14 : Empêcher de recevoir plus que commandé."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
        )
        item = PurchaseItem.objects.create(
            purchase=purchase,
            medicine=self.medicine1,
            quantity_ordered=20,
            unit_price='10.00'
        )

        # Une réception de 25 unités doit être refusée dès sa création
        with self.assertRaises(ValidationError):
            PurchaseReceipt.objects.create(
                purchase_item=item,
                quantity=25,
                received_by=self.admin_user,
                status='DRAFT',
                batch_number='TEST-LOT-012',
                manufacturing_date=timezone.now().date(),
                expiry_date=timezone.now().date() + timezone.timedelta(days=365),
            )

        # Vérifier qu'aucune quantité n'a été reçue
        item.refresh_from_db()
        self.assertEqual(item.quantity_received, 0)

    def test_purchase_clean_cancelled(self):
        """Test 15 : Interdiction de modifier achat annulé."""
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            ordered_by=self.admin_user,
            status='CANCELLED',
        )
        # Essayer de nettoyer - devrait lever ValidationError
        with self.assertRaises(ValidationError):
            purchase.clean()
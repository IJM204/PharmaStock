from django.db import models, transaction
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import F, Sum
from django.utils import timezone
from suppliers.models import Supplier
from medicines.models import Medicine


def recalculate_purchase_total(purchase):
    """
    Recalcule le montant total d'un achat à partir de ses items.
    Utilise une mise à jour SQL directe pour éviter la récursion.
    """
    total = purchase.items.aggregate(
        total=Sum(F('quantity_ordered') * F('unit_price'))
    )['total'] or 0
    # Raw update pour éviter de déclencher save() et les signaux nuevamente
    Purchase.objects.filter(pk=purchase.pk).update(total_amount=total)
    return total


def validate_lot_dates(manufacturing_date, expiry_date):
    """
    Valide la cohérence des dates de lot.
    Lève ValidationError si les dates sont incohérentes.
    """
    if manufacturing_date and expiry_date:
        if manufacturing_date > expiry_date:
            raise ValidationError(
                "La date d'expiration doit être postérieure à la date de fabrication."
            )


# Signaux pour mettre à jour le total automatiquement lorsqu'un item change
from django.db.models import signals
from django.dispatch import receiver


@receiver(signals.post_save, sender='purchases.PurchaseItem')
@receiver(signals.post_delete, sender='purchases.PurchaseItem')
def update_purchase_total_on_item_change(sender, instance, **kwargs):
    """
    Signal triggered when a PurchaseItem is saved or deleted.
    Recalculates the total amount for the associated Purchase.
    Utilise raw SQL UPDATE pour éviter la récursion des signaux.
    """
    purchase = instance.purchase
    if purchase:
        recalculate_purchase_total(purchase)


class Purchase(models.Model):
    """Représente un achat auprès d'un fournisseur."""

    STATUS_CHOICES = [
        ('PENDING', 'En attente'),
        ('PARTIAL', 'Partiel'),
        ('RECEIVED', 'Réçu'),
        ('CANCELLED', 'Annulé'),
    ]

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='purchases'
    )
    ordered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='purchases_ordered'
    )
    order_date = models.DateTimeField(auto_now_add=True)
    expected_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date de livraison attendue"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Montant total de l'achat (recalculé automatiquement)"
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-order_date']
        verbose_name = "Achat"
        verbose_name_plural = "Achats"

    def __str__(self):
        return f"Achat #{self.id} - {self.supplier.name} - {self.order_date:%Y-%m-%d}"

    def recalculate_total(self):
        """Méthode publique pour forcer le recalcul du total."""
        return recalculate_purchase_total(self)

    def clean(self):
        """Validation de l'achat."""
        # Un achat annulé ne peut pas recevoir de marchandises
        if self.status == 'CANCELLED':
            raise ValidationError(
                "Impossible de modifier un achat annulé."
            )


class PurchaseItem(models.Model):
    """Ligne d'un achat - les médicaments commandés."""

    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name='items'
    )
    medicine = models.ForeignKey(
        Medicine,
        on_delete=models.PROTECT,
        help_text="Le médicament commandé"
    )
    quantity_ordered = models.PositiveIntegerField(
        help_text="Quantité commandée (doit être > 0)"
    )
    quantity_received = models.PositiveIntegerField(
        default=0,
        help_text="Quantité reçue cumulée (pour reçus partiels)"
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Prix unitaire au moment de l'achat"
    )
    manufacturing_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date de fabrication"
    )
    expiry_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date d'expiration"
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ligne d'achat"
        verbose_name_plural = "Lignes d'achat"
        ordering = ['medicine__name']
        unique_together = ['purchase', 'medicine']

    def __str__(self):
        return f"{self.medicine.name} - {self.quantity_ordered} x {self.unit_price}"

    def subtotal(self):
        """Retourne le sous-total pour cette ligne."""
        return self.quantity_ordered * self.unit_price

    def clean(self):
        """Validations complètes sur la ligne d'achat."""
        errors = []

        # 1. Quantité commandée doit être positive
        if self.quantity_ordered <= 0:
            errors.append("La quantité commandée doit être supérieure à zéro.")

        # 2. Prix unitaire doit être non négatif
        if self.unit_price < 0:
            errors.append("Le prix unitaire ne peut pas être négatif.")

        # 3. Médicament doit être actif
        if not self.medicine.is_active:
            errors.append(
                f"Le médicament '{self.medicine.name}' n'est pas actif."
            )

        # 4. Dates cohérentes si les deux sont présentes
        validate_lot_dates(self.manufacturing_date, self.expiry_date)

        # 5. Quantité reçue cumulée ne doit pas dépasser quantité commandée
        if self.quantity_received > self.quantity_ordered:
            errors.append("La quantité reçue cumulée ne peut pas dépasser la quantité commandée.")

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        """Surcharge save : validation + sauvegarde + déclencheur de recalcul."""
        self.full_clean()  # Appelle clean() et valide tous les champs
        super().save(*args, **kwargs)

        # Déclencher le recalcul du total de l'achat parent
        # Le signal post_save va aussi le faire, mais on le fait ici aussi
        # pour s'assurer que c'est fait immédiatement après la sauvegarde
        if self.purchase_id:
            recalculate_purchase_total(self.purchase)


class PurchaseReceipt(models.Model):
    """Enregistrement d'une réception d'achat avec traçabilité des lots."""

    # Statut de la réception
    RECEIPT_STATUS = [
        ('DRAFT', 'Brouillon'),
        ('CONFIRMED', 'Confirmée'),
        ('CANCELLED', 'Annulée'),
    ]

    purchase_item = models.ForeignKey(
        PurchaseItem,
        on_delete=models.CASCADE,
        related_name='receipts'
    )
    quantity = models.PositiveIntegerField(
        help_text="Quantité reçue dans cet événement"
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='purchase_receipts'
    )
    receipt_date = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    # Informations de lot spécifiques à cette réception
    batch_number = models.CharField(
        max_length=100,
        help_text="Numéro de lot (obligatoire, doit être unique)"
    )
    manufacturing_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date de fabrication (issue du médicament si non fournie)"
    )
    expiry_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date d'expiration (issue du médicament si non fournie)"
    )

    status = models.CharField(
        max_length=20,
        choices=RECEIPT_STATUS,
        default='DRAFT'
    )

    class Meta:
        verbose_name = "Réception d'achat"
        verbose_name_plural = "Réceptions d'achat"
        ordering = ['-receipt_date']

    def __str__(self):
        return (f"Réception - {self.purchase_item.medicine.name} "
                f"- {self.quantity} unités - {self.get_status_display()}")

    def clean(self):
        """Validations spécifiques aux réceptions."""
        errors = []

        # 1. Une réception confirmée ne peut pas être modifiée
        if self.pk:
            try:
                existing = PurchaseReceipt.objects.get(pk=self.pk)
                if existing.status == 'CONFIRMED':
                    # Impossible de modifier ou supprimer une réception confirmée
                    if self.status != 'CONFIRMED':
                        errors.append("Impossible de modifier une réception déjà confirmée.")
                    if self.status == 'CANCELLED':
                        errors.append("Impossible de supprimer une réception confirmée. Utilisez l'annulation prévue.")
            except PurchaseReceipt.DoesNotExist:
                pass

        # 2. Quantité reçue ne peut pas dépasser le restant à recevoir
        remaining = self.purchase_item.quantity_ordered - self.purchase_item.quantity_received
        if self.quantity > remaining:
            errors.append(
                f"Quantité reçue ({self.quantity}) ne peut pas dépasser le restant ({remaining})."
            )

        # 3. Validation des dates du lot
        # Si non fournies sur la réception, tenter d'utiliser celles de l'item/médicament
        mfg = self.manufacturing_date
        exp = self.expiry_date

        if not mfg or not exp:
            # Essayer d'utiliser celles de PurchaseItem
            if self.purchase_item.manufacturing_date:
                mfg = self.purchase_item.manufacturing_date
            if self.purchase_item.expiry_date:
                exp = self.purchase_item.expiry_date

            # Si toujours manquantes, lever une erreur
            if not mfg or not exp:
                errors.append("Les dates de lot (fabrication/expiration) sont obligatoires.")

        # Si on a les deux dates, vérifier la cohérence
        if mfg and exp:
            if mfg > exp:
                errors.append("La date d'expiration doit être postérieure à la date de fabrication.")

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        """Surcharge save : validation seulement. Le traitement complet se fait via process_receipt()."""
        # Interdire la modification d'un reçu confirmé
        if self.pk:
            try:
                existing = PurchaseReceipt.objects.get(pk=self.pk)
                if existing.status == 'CONFIRMED':
                    raise ValidationError(
                        "Impossible de modifier une réception déjà confirmée."
                    )
            except PurchaseReceipt.DoesNotExist:
                pass
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """
        Surcharge delete pour interdire la suppression directe
        d'une réception confirmée.
        Avertissement : cette protection ne s'applique pas aux
        requêtes QuerySet.delete() ou SQL direct.
        """
        if self.pk:
            try:
                existing = PurchaseReceipt.objects.get(pk=self.pk)
                if existing.status == 'CONFIRMED':
                    raise ValidationError(
                        "Impossible de supprimer une réception déjà confirmée. "
                        "Utilisez l'annulation prévue ou contactez l'administration."
                    )
            except PurchaseReceipt.DoesNotExist:
                pass
        super().delete(*args, **kwargs)

    def process_receipt(self):
        """
        Traite entièrement la réception d'achat de manière atomique.
        Doit être appelée dans un contexte transactionnel.

        Étapes :
        1. Lock le reçu, l'achat et la ligne d'achat pour éviter les conditions de course
        2. Vérifier que le reçu n'est pas déjà confirmé
        3. Vérifier que l'achat n'est pas annulé
        4. Valider les informations du lot
        5. Créer le Batch atomiquement
        6. Créer le StockMovement de type IN
        7. Mettre à jour quantity_received sur l'item
        8. Mettre à jour le statut de l'achat
        9. Passer le reçu à CONFIRMED

        Returns le Batch créé.
        """
        with transaction.atomic():
            # 1. Lock le reçu, l'achat et la ligne d'achat dans un ordre cohérent
            # Verrouillage par ordre pour éviter les deadlocks : receipt -> purchase -> item
            receipt = PurchaseReceipt.objects.select_for_update().get(pk=self.pk)
            purchase = Purchase.objects.select_for_update().get(pk=receipt.purchase_item.purchase.id)
            item = PurchaseItem.objects.select_for_update().get(pk=receipt.purchase_item.id)

            # 2. Vérifier que le reçu n'est pas déjà confirmé
            if receipt.status == 'CONFIRMED':
                raise ValidationError(
                    "Impossible de traiter une réception déjà confirmée. "
                    "Cette réception a déjà été prise en compte."
                )

            # 3. Vérifier que l'achat n'est pas annulé
            if purchase.status == 'CANCELLED':
                raise ValidationError(
                    "Impossible de réceptionner un achat annulé. "
                    "L'achat annulé ne peut pas recevoir de marchandises."
                )

            # 4. Vérifier la quantité restante (sur l'item verrouillé)
            remaining = item.quantity_ordered - item.quantity_received
            if self.quantity > remaining:
                raise ValidationError(
                    f"Quantité reçue ({self.quantity}) dépasse le restant ({remaining})."
                )

            # 5. Déterminer les informations du lot
            # Utiliser les valeurs fournie sur la réception, fallback vers l'item/médicament
            mfg = self.manufacturing_date
            exp = self.expiry_date

            if not mfg or not exp:
                # Fallback vers PurchaseItem
                if item.manufacturing_date:
                    mfg = item.manufacturing_date
                if item.expiry_date:
                    exp = item.expiry_date

            if not mfg or not exp:
                raise ValidationError(
                    "Dates de lot obligatoires : fournissez-les sur la réception ou assurez-vous qu'elles existent sur l'item/médicament."
                )

            validate_lot_dates(mfg, exp)

            # 6. S'assurer que batch_number est unique
            from inventory.models import Batch as InventoryBatch
            proposed_batch_number = self.batch_number
            # Vérifier l'unicité - enlever les caractères spéciaux pour le format
            if InventoryBatch.objects.filter(batch_number=proposed_batch_number).exists():
                # Ajouter un suffixe pour rendre unique
                import uuid
                proposed_batch_number = f"{self.batch_number}-{uuid.uuid4().hex[:8]}"

            # 7. Créer le Batch atomiquement (avec tentatives pour unicité)
            max_attempts = 10
            for attempt in range(max_attempts):
                try:
                    # Essayer de créer avec sélection pour éviter les collisions
                    batch = InventoryBatch.objects.create(
                        medicine=item.medicine,
                        batch_number=proposed_batch_number,
                        quantity_received=self.quantity,
                        quantity_available=self.quantity,
                        purchase_price=item.unit_price,
                        manufacturing_date=mfg,
                        expiry_date=exp,
                    )
                    break
                except Exception:
                    if attempt < max_attempts - 1:
                        # Modifier légèrement le batch_number
                        proposed_batch_number = f"{self.batch_number}-{uuid.uuid4().hex[:4]}"
                    else:
                        raise

            # 8. Vérifier si le lot n'est pas expiré (logique existante)
            today = timezone.localdate()

            if batch.expiry_date < today:
                # La logique existante interdit les IN sur lots expirés
                raise ValidationError(
                    "Impossible de recevoir un lot expiré. Vérifiez la date d'expiration."
                )

            from inventory.models import StockMovement as InventoryStockMovement

            movement = InventoryStockMovement.objects.create(
                batch=batch,
                movement_type='IN',
                quantity=self.quantity,
                reason=f"Réception achat #{purchase.id}",
                performed_by=receipt.received_by
            )

            # 9. Mettre à jour la quantité reçue sur l'item d'achat
            # Attention : on doit être prudent ici. L'item peut déjà avoir
            # des receipts précédents. On incrémente simplement.
            item.quantity_received += self.quantity
            item.save(update_fields=['quantity_received'])

            # 10. Mettre à jour le statut de l'achat
            total_received = purchase.items.aggregate(
                total=Sum('quantity_received')
            )['total'] or 0
            total_ordered = purchase.items.aggregate(
                total=Sum('quantity_ordered')
            )['total'] or 0

            if total_received >= total_ordered:
                purchase.status = 'RECEIVED'
            elif total_received > 0:
                purchase.status = 'PARTIAL'
            else:
                purchase.status = 'PENDING'
            purchase.save(update_fields=['status'])

            # 10. Passer le reçu à CONFIRMED
            # Mettre à jour le reçu verrouillé
            receipt.status = 'CONFIRMED'
            receipt.save(update_fields=['status'])

            return batch

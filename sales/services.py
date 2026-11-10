from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from medicines.models import Medicine
from inventory.models import Batch, StockMovement
from .models import Sale, SaleItem


@transaction.atomic
def create_sale(sold_by, items):
    """
    Crée une vente en utilisant les lots selon la méthode FEFO.

    Format attendu :
    [
        {"medicine_id": 1, "quantity": 3},
        {"medicine_id": 2, "quantity": 2}
    ]
    """

    if not items:
        raise ValidationError("La vente doit contenir au moins un médicament.")

    today = timezone.localdate()
    allocations = []
    processed_medicines = set()

    # 1. Vérifier les médicaments et préparer les lots à utiliser.
    for item in items:

        medicine_id = item.get('medicine_id')
        quantity = item.get('quantity')

        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
            raise ValidationError(
                "La quantité doit être un entier strictement positif."
            )

        if medicine_id in processed_medicines:
            raise ValidationError(
                "Un même médicament ne doit apparaître qu'une seule fois."
            )

        processed_medicines.add(medicine_id)

        try:
            medicine = Medicine.objects.get(
                pk=medicine_id,
                is_active=True
            )
        except Medicine.DoesNotExist:
            raise ValidationError(
                f"Le médicament {medicine_id} est introuvable ou inactif."
            )

    # 2 . Verrouiller les lots disponibles et les classer par FEFO.
        batches = list(
            Batch.objects.select_for_update()
            .filter(
                medicine=medicine,
                quantity_available__gt=0,
                expiry_date__gte=today
            )
            .order_by('expiry_date', 'created_at', 'id')
        )
    # 3. Vérifier le prix du lot disponible le plus cher.
        if batches:
            highest_purchase_price = max(
                batch.purchase_price for batch in batches
            )

            if medicine.unit_price < highest_purchase_price:
                raise ValidationError(
                    f"Vente impossible pour {medicine.name}. "
                    f"Le prix de vente ({medicine.unit_price}) doit couvrir "
                    f"le lot disponible le plus cher "
                    f"({highest_purchase_price})."
                )

    # 4. Vérifier la quantité disponible.
        available_quantity = sum(
            batch.quantity_available for batch in batches
        )

        if available_quantity < quantity:
            raise ValidationError(
                f"Stock insuffisant pour {medicine.name}. "
                f"Disponible : {available_quantity}, demandé : {quantity}."
            )

    # 5. Répartir la quantité entre les lots selon FEFO.
        remaining_quantity = quantity

        for batch in batches:

            if remaining_quantity == 0:
                break

            quantity_to_sell = min(
                remaining_quantity,
                batch.quantity_available
            )

            allocations.append({
                'medicine': medicine,
                'batch': batch,
                'quantity': quantity_to_sell,
                'unit_price': medicine.unit_price,
            })

            remaining_quantity -= quantity_to_sell


    # 6. Créer la vente.
    sale = Sale.objects.create(
        sold_by=sold_by
    )

    # 7. Enregistrer les lignes, diminuer le stock et tracer les sorties.
    for allocation in allocations:

        batch = allocation['batch']
        quantity = allocation['quantity']

        batch.quantity_available -= quantity
        batch.save(update_fields=[
            'quantity_available',
            'updated_at'
        ])

        SaleItem.objects.create(
            sale=sale,
            batch=batch,
            quantity=quantity,
            unit_price=allocation['unit_price']
        )

        StockMovement.objects.create(
            batch=batch,
            movement_type='OUT',
            quantity=quantity,
            reason=f"Vente #{sale.id}",
            performed_by=sold_by
        )

    # 8. Calculer le montant total.
    sale.recalculate_total()

    return sale

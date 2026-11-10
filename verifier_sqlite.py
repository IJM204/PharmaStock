import sqlite3
from pathlib import Path

fichiers = [
    "db.sqlite3",
    "db.sqlite3.backup",
    "db.sqlite3.backup-20261102",
    "db.sqlite3.inconsistent-20261102",
]

tables_a_verifier = [
    "accounts_user",
    "medicines_category",
    "medicines_medicine",
    "suppliers_supplier",
]

for fichier in fichiers:
    chemin = Path(fichier).resolve()
    print(f"\n--- {fichier} ---")

    if not chemin.exists():
        print("Fichier introuvable")
        continue

    connexion = sqlite3.connect(f"file:{chemin}?mode=ro", uri=True)

    for table in tables_a_verifier:
        existe = connexion.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,)
        ).fetchone()

        if existe:
            nombre = connexion.execute(
                f'SELECT COUNT(*) FROM "{table}"'
            ).fetchone()[0]
            print(f"{table} : {nombre}")
        else:
            print(f"{table} : table absente")

    connexion.close()

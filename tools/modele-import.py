"""Génère data/modele-import.xlsx (modèle d'import des parties et entraînements)."""
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

out = sys.argv[1] if len(sys.argv) > 1 else "data/modele-import.xlsx"
F = "IBM Plex Sans"
H = Font(name=F, bold=True, color="FFFFFF", size=10)
HF = PatternFill("solid", fgColor="1F2937")
N = Font(name=F, size=10)
M = Font(name=F, size=9, color="6B7280", italic=True)
T = Font(name=F, size=14, bold=True, color="111827")
S2 = Font(name=F, size=11, bold=True, color="111827")
EX = PatternFill("solid", fgColor="F3F4F6")
thin = Side(style="thin", color="D1D5DB")
B = Border(bottom=thin)

wb = Workbook()

def sheet(ws, cols, notes, n=400):
    for i, (h, w) in enumerate(cols, 1):
        c = ws.cell(row=1, column=i, value=h); c.font = H; c.fill = HF; c.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[c.column_letter].width = w
        m = ws.cell(row=2, column=i, value=notes[i - 1]); m.font = M; m.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[1].height = 30; ws.row_dimensions[2].height = 42
    ws.freeze_panes = "A3"
    for r in range(3, n + 3):
        for i in range(1, len(cols) + 1): ws.cell(row=r, column=i).font = N

# Lisez-moi
ws = wb.active; ws.title = "Lisez-moi"
ws.column_dimensions["A"].width = 110
lines = [
    ("Modèle d'import — Golf Mid-Am", T),
    ("", N),
    ("1. Remplis l'onglet « Parties » et/ou l'onglet « Entraînements » à partir de la ligne 3 (la ligne 2 est une aide, elle est ignorée).", N),
    ("2. Enregistre le fichier (.xlsx ou .csv), puis dans l'appli : Plus › Import › Choisir un fichier.", N),
    ("3. L'appli affiche un aperçu ligne par ligne avant d'importer : rien n'est écrit tant que tu n'as pas validé.", N),
    ("", N),
    ("Parties — une ligne par trou joué", S2),
    ("• Toutes les lignes qui portent le même n° de « Partie » forment une carte. Date et Parcours suffisent sur la première ligne de la partie.", N),
    ("• Obligatoire : Partie, Date, Parcours, Trou, Par, Score. Le reste est facultatif mais alimente les statistiques (putts, fairways, < 2 m ratés, pénalités).", N),
    ("• Fairway : Touché, Gauche ou Droite (vide sur les par 3).", N),
    ("• CR et Slope (facultatifs) permettent de calculer le différentiel de la partie (18 trous).", N),
    ("• Une partie déjà présente (même date, même parcours) est signalée et ignorée.", N),
    ("", N),
    ("Entraînements — une ligne par entraînement libre", S2),
    ("• Obligatoire : Date, Durée (min), Types.", N),
    ("• Types : un ou plusieurs parmi Physique, Long jeu, Wedging, Chipping, Bunker, Putting, séparés par une virgule.", N),
    ("• Qualité : de 1 à 5. Les entraînements comptent dans l'objectif de séances.", N),
    ("", N),
    ("Dates : format date Excel ou JJ/MM/AAAA.", M),
]
for i, (t, f) in enumerate(lines, 1):
    c = ws.cell(row=i, column=1, value=t); c.font = f; c.alignment = Alignment(wrap_text=True)
ex = [("Exemple « Parties »", None), ("Partie | Date | Parcours | Type | Repère | Trou | Par | Score | Putts | Fairway | < 2 m ratés | Pénalités", None),
      ("1 | 12/10/2026 | Golf de Bondues — Blanc | Compétition | Blanc | 1 | 4 | 5 | 2 | Gauche | 0 | 0", None),
      ("1 |  |  |  |  | 2 | 3 | 3 | 2 |  | 0 | 0", None),
      ("Exemple « Entraînements »", None), ("12/10/2026 | 60 | Wedging, Putting | 50 balles 30-60 m puis putts à 2 m | 14/20 à 2 m | 4 | Bon rythme", None)]
r0 = len(lines) + 2
for i, (t, _) in enumerate(ex):
    c = ws.cell(row=r0 + i, column=1, value=t); c.font = S2 if t.startswith("Exemple") else N
    if not t.startswith("Exemple"): c.fill = EX

# Parties
ws = wb.create_sheet("Parties")
cols = [("Partie", 8), ("Date", 12), ("Parcours", 30), ("Type", 18), ("Repère", 10), ("CR", 7), ("Slope", 7),
        ("Trou", 6), ("Par", 6), ("Score", 7), ("Putts", 7), ("Fairway", 10), ("< 2 m ratés", 10), ("Pénalités", 10), ("Notes", 30)]
notes = ["N° commun à tous les trous d'une carte", "JJ/MM/AAAA", "Nom du golf et du parcours", "Compétition, Partie qualificative, Partie amicale, Entraînement sur le parcours",
         "Ex. Blanc", "Facultatif", "Facultatif", "1 à 18", "3, 4 ou 5", "Coups joués", "Facultatif", "Touché / Gauche / Droite", "Putts < 2 m manqués", "Coups de pénalité", "Facultatif"]
sheet(ws, cols, notes)
for col, lst in (("D", '"Compétition,Partie qualificative,Partie amicale,Entraînement sur le parcours"'), ("L", '"Touché,Gauche,Droite"'), ("I", '"3,4,5"')):
    dv = DataValidation(type="list", formula1=lst, allow_blank=True); ws.add_data_validation(dv); dv.add(f"{col}3:{col}402")
for r in range(3, 403): ws.cell(row=r, column=2).number_format = "DD/MM/YYYY"

# Entraînements
ws = wb.create_sheet("Entraînements")
cols = [("Date", 12), ("Durée (min)", 11), ("Types", 26), ("Contenu", 44), ("Mesure / résultat", 22), ("Qualité", 8), ("Sensations / remarques", 40)]
notes = ["JJ/MM/AAAA", "Minutes", "Physique, Long jeu, Wedging, Chipping, Bunker, Putting (virgules)", "Facultatif", "Ex. 14/20 putts à 2 m", "1 à 5", "Facultatif"]
sheet(ws, cols, notes)
dv = DataValidation(type="list", formula1='"1,2,3,4,5"', allow_blank=True); ws.add_data_validation(dv); dv.add("F3:F402")
dv = DataValidation(type="list", formula1='"Physique,Long jeu,Wedging,Chipping,Bunker,Putting"', allow_blank=True, showErrorMessage=False); ws.add_data_validation(dv); dv.add("C3:C402")
for r in range(3, 403): ws.cell(row=r, column=1).number_format = "DD/MM/YYYY"
wb.save(out); print(out)

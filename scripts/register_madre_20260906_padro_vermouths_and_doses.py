#!/usr/bin/env python3
"""Cadastra vermutes Padro & Co das fotos 2026-09-06 e cria doses 60 ml na Madre."""

from __future__ import annotations

import argparse
import copy
import json
import math
import re
import shutil
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font


API_BASE = "https://gestor-estoque-zqw9.onrender.com/api"
COMPANY_ID = 13
PRICE_WORKBOOK = Path("/home/leomassoni/Downloads/Lista de preços Bar.xlsx")
OUTPUT_WORKBOOK = Path(
    "/home/leomassoni/Downloads/Bebidas novas fotos 2026-09-06 Padro - custos e doses Casa de mi Madre.xlsx"
)
BACKUP_ROOT = Path("backups")
AUDIT_ROOT = Path("auditorias")
DOSE_VOLUME_ML = Decimal("60")
MAX_CMV = Decimal("35")
EUR_BRL = Decimal("5.95496")
IOF_PERCENT = Decimal("3.5")


PHOTO_ITEMS: list[dict[str, Any]] = [
    {
        "photo": "WhatsApp Image 2026-09-06 at 13.36.12.jpeg",
        "product_name": "VERMOUTH PADRO & CO BLANCO RESERVA",
        "volume_ml": Decimal("750"),
        "alcohol": "18",
        "family": "BEBIDAS",
        "subfamily": "VERMUTES",
        "currency": "EUR",
        "source_value": Decimal("12.07"),
        "exchange_rate": EUR_BRL,
        "iof_percent": IOF_PERCENT,
        "sale_price": Decimal("45"),
        "cost_source": (
            "Media online: Grau Online EUR 11,93; Atragos EUR 11,50; "
            "Amazon/QuieroVinos via Globerada EUR 12,00/EUR 12,85."
        ),
        "data_source": "Rotulo da foto: Padro & Co Blanco Reserva Vermouth, 750 ml, 18% vol., EAN 8427221023915.",
        "source_urls": [
            "https://www.grauonline.eu/vermouth/blanco-reserva-padro-co/",
            "https://www.atragos.es/product/vermut-padro-co-blanco-reserva-75cl",
            "https://globerada.com/precios/padro-co-vermouth-white-reserve-pack-1-x-750-ml-1-x-75-cl-8410434009057",
        ],
        "aliases": ["PADRO BLANCO RESERVA", "PADRO & CO BLANCO RESERVA", "PADRO CO BLANCO RESERVA"],
        "barcode": "8427221023915",
    },
    {
        "photo": "WhatsApp Image 2026-09-06 at 13.36.09.jpeg",
        "product_name": "VERMOUTH PADRO & CO ROJO CLASICO",
        "volume_ml": Decimal("750"),
        "alcohol": "18",
        "family": "BEBIDAS",
        "subfamily": "VERMUTES",
        "currency": "EUR",
        "source_value": Decimal("10.12"),
        "exchange_rate": EUR_BRL,
        "iof_percent": IOF_PERCENT,
        "sale_price": Decimal("45"),
        "cost_source": (
            "Media online: Enterwine EUR 9,95; Atragos EUR 11,00; "
            "Globerada a partir de EUR 10,48; Compra-Vino EUR 9,06."
        ),
        "data_source": "Rotulo da foto: Padro & Co Rojo Clasico Vermouth, 750 ml, 18% vol., EAN 8427221023946.",
        "source_urls": [
            "https://www.enterwine.com/vermuts/vermut-padro-rojo-clasico",
            "https://www.atragos.es/product/vermut-padro-co-rojo-amargo-75cl",
            "https://globerada.com/precios/vermouth-padro-co-rojo-clasico-18-vol",
            "https://compra-vino.com/padro-vermouth-rojo-clasico-075-l/",
        ],
        "aliases": ["PADRO ROJO CLASICO", "PADRO & CO ROJO CLASICO", "PADRO CO ROJO CLASICO"],
        "barcode": "8427221023946",
    },
    {
        "photo": "WhatsApp Image 2026-09-06 at 13.36.07.jpeg",
        "product_name": "VERMOUTH PADRO & CO DORADO AMARGO SUAVE",
        "volume_ml": Decimal("750"),
        "alcohol": "18",
        "family": "BEBIDAS",
        "subfamily": "VERMUTES",
        "currency": "EUR",
        "source_value": Decimal("11.95"),
        "exchange_rate": EUR_BRL,
        "iof_percent": IOF_PERCENT,
        "sale_price": Decimal("45"),
        "cost_source": (
            "Media online: loja oficial Padro EUR 11,95; Grau Online EUR 11,37; Enterwine EUR 11,20; "
            "Amazon EUR 13,20; Atragos EUR 12,00; Compra-Vino EUR 11,95."
        ),
        "data_source": "Rotulo da foto: Padro & Co Dorado Amargo Suave Vermouth, 750 ml, 18% vol., EAN 8427221023939.",
        "source_urls": [
            "https://padrovermuts.com/en/products/padro-co-dorado-amargo-suave",
            "https://www.grauonline.eu/vermouth/dorado-amargo-suave-padro-co/",
            "https://www.enterwine.com/vermuts/vermut-padro-dorado-amargo-suave",
            "https://www.amazon.es/Padro-Dorado-Amargo-Suave-Vermouth/dp/B078HBYS19",
            "https://www.atragos.es/product/vermut-padro-co-dorado-amargo-suave-75cl",
            "https://compra-vino.com/padro-vermouth-dorado-amargo-suave-075-l/",
        ],
        "aliases": [
            "PADRO DORADO AMARGO SUAVE",
            "PADRO & CO DORADO AMARGO SUAVE",
            "PADRO CO DORADO AMARGO SUAVE",
        ],
        "barcode": "8427221023939",
    },
]


def normalize(value: Any) -> str:
    text = "".join(
        char for char in unicodedata.normalize("NFD", str(value or "")) if unicodedata.category(char) != "Mn"
    )
    text = re.sub(r"[^A-Za-z0-9]+", " ", text.upper()).strip()
    return re.sub(r"\s+", " ", text)


def decimal_from(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    text = str(value).strip().replace("R$", "").replace("%", "")
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    text = re.sub(r"[^0-9.\-]", "", text)
    if not text:
        return None
    try:
        return Decimal(text)
    except Exception:
        return None


def number_text(value: Decimal | None) -> str:
    if value is None:
        return ""
    normalized = value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP).normalize()
    return format(normalized, "f")


def api_json(path: str, method: str = "GET", payload: Any | None = None, params: dict[str, Any] | None = None) -> Any:
    url = f"{API_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Content-Type": "application/json"} if body is not None else {},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} -> HTTP {error.code}: {detail}") from error


def read_price_sheet_rows() -> list[dict[str, Any]]:
    workbook = load_workbook(PRICE_WORKBOOK, data_only=True)
    rows: list[dict[str, Any]] = []
    for sheet in workbook.worksheets:
        headers = [sheet.cell(1, column).value for column in range(1, sheet.max_column + 1)]
        for row_index in range(2, sheet.max_row + 1):
            row = {headers[column - 1]: sheet.cell(row_index, column).value for column in range(1, sheet.max_column + 1)}
            row["_sheet"] = sheet.title
            row["_row"] = row_index
            rows.append(row)
    return rows


def find_price_sheet_match(item: dict[str, Any], price_rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    aliases = [normalize(item["product_name"]), *(normalize(alias) for alias in item.get("aliases", []))]
    for row in price_rows:
        item_name = normalize(row.get("Item"))
        if not item_name:
            continue
        for alias in aliases:
            if alias and (alias in item_name or item_name in alias):
                return row
    return None


def visible_for_company(record: dict[str, Any]) -> bool:
    return (
        record.get("companyId") == COMPANY_ID
        or record.get("ownerCompanyId") == COMPANY_ID
        or COMPANY_ID in (record.get("sharedCompanyIds") or [])
    )


def active_package(product: dict[str, Any]) -> dict[str, Any] | None:
    packages = product.get("packages") or []
    active = [package for package in packages if package.get("isActive") is not False]
    return active[0] if active else (packages[0] if packages else None)


def package_ml(product: dict[str, Any]) -> Decimal | None:
    package = active_package(product)
    if not package:
        return None
    quantity = decimal_from(package.get("packageQuantity"))
    if quantity is None or quantity <= 0:
        return None
    unit = normalize(package.get("packageUnit") or product.get("controlUnit"))
    if unit in {"L", "LITER", "LITRO", "LITROS"}:
        return quantity * Decimal("1000")
    return quantity


def package_cost(product: dict[str, Any]) -> Decimal | None:
    package = active_package(product)
    if not package:
        return None
    return decimal_from(package.get("purchasePrice"))


def round_up_to_5(value: Decimal) -> Decimal:
    return Decimal(str(int(math.ceil(float(value) / 5.0) * 5)))


def final_cost(item: dict[str, Any]) -> Decimal:
    converted = item["source_value"] * item["exchange_rate"]
    iof = converted * (item["iof_percent"] / Decimal("100"))
    return (converted + iof).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def suggested_sale_price(cost: Decimal, volume_ml: Decimal, fixed_price: Decimal | None = None) -> Decimal:
    if fixed_price is not None:
        return fixed_price
    dose_cost = (cost / volume_ml) * DOSE_VOLUME_ML
    minimum_by_cmv = dose_cost / (MAX_CMV / Decimal("100"))
    return round_up_to_5(max(minimum_by_cmv, Decimal("45")))


def find_existing_product(item: dict[str, Any], products: list[dict[str, Any]]) -> dict[str, Any] | None:
    keys = {normalize(item["product_name"]), *(normalize(alias) for alias in item.get("aliases", []))}
    for product in products:
        if product.get("technicalSheetId") or not visible_for_company(product):
            continue
        if normalize(product.get("name")) in keys:
            return product
    return None


def find_existing_dose_sheet(product_id: str, sale_name: str, sheets: list[dict[str, Any]]) -> dict[str, Any] | None:
    sale_key = normalize(sale_name)
    for sheet in sorted(sheets, key=lambda record: record.get("id") or 0):
        if sheet.get("kind") != "VENDA" or sheet.get("isActive") is not True or not visible_for_company(sheet):
            continue
        if normalize(sheet.get("name")) == sale_key:
            return sheet
        for ingredient in sheet.get("ingredients") or []:
            if ingredient.get("isActive") is True and ingredient.get("productId") == product_id:
                quantity = decimal_from(ingredient.get("quantity"))
                if quantity == DOSE_VOLUME_ML:
                    return sheet
    return None


def reference_codes(item: dict[str, Any]) -> list[dict[str, Any]]:
    barcode = str(item.get("barcode") or "").strip()
    if not barcode:
        return []
    return [
        {
            "id": int(time.time() * 1000),
            "code": barcode,
            "source": "rotulo",
            "type": "EAN" if barcode.isdigit() and len(barcode) in {8, 12, 13, 14} else "OUTRO",
            "isActive": True,
        }
    ]


def build_product_payload(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": "",
        "companyId": COMPANY_ID,
        "ownerCompanyId": COMPANY_ID,
        "companyProductId": "",
        "name": item["product_name"],
        "controlUnit": "MILLILITER",
        "family": item["family"],
        "subfamily": item["subfamily"],
        "sectors": ["BAR"],
        "alcoholPercentage": item["alcohol"],
        "densitySampleVolume": "",
        "densitySampleWeight": "",
        "ignoreStock": False,
        "excludeFromExecutionYield": False,
        "isActive": True,
        "technicalSheetId": None,
        "packages": [
            {
                "id": 1,
                "companyPackageId": "",
                "referenceCodes": reference_codes(item),
                "internalCode": "EMB-001",
                "barcode": str(item.get("barcode") or "") if str(item.get("barcode") or "").isdigit() else "",
                "packageQuantity": number_text(item["volume_ml"]),
                "packageUnit": "MILLILITER",
                "grossWeightGrams": "",
                "packagingWeightGrams": "",
                "purchasePrice": number_text(final_cost(item)),
                "openingQuantity": "",
                "isActive": True,
            }
        ],
    }


def build_sheet_payload(product: dict[str, Any], sale_name: str, sale_price: Decimal, cmv: Decimal) -> dict[str, Any]:
    ingredient_id = int(time.time() * 1000)
    return {
        "id": 0,
        "companyId": COMPANY_ID,
        "ownerCompanyId": COMPANY_ID,
        "sharedCompanyIds": [],
        "kind": "VENDA",
        "productId": "",
        "companyProductId": "",
        "companyProductIdsByCompanyId": {},
        "name": sale_name,
        "family": "DOSES 60ML",
        "subfamily": "VERMUTES",
        "sectors": product.get("sectors") or ["BAR"],
        "outputQuantity": "1",
        "outputUnit": "UNIT",
        "densitySampleVolume": "",
        "densitySampleWeight": "",
        "yieldDifferenceDestination": "",
        "yieldDifferenceByproductName": "",
        "yieldDifferenceByproductTechnicalSheetId": None,
        "targetPh": "",
        "targetBrix": "",
        "portionSize": "1",
        "colorTagOne": "",
        "colorTagTwo": "",
        "desiredCmvPercentage": number_text(cmv),
        "dilutionRatePercentage": "",
        "imageDataUrl": "",
        "finalSalePrice": number_text(sale_price),
        "flavorProfileRatings": [],
        "flavorSweet": "0",
        "flavorSour": "0",
        "flavorBitter": "0",
        "flavorSalty": "0",
        "flavorUmami": "0",
        "storytelling": "",
        "salesArguments": "",
        "harmonization": "",
        "preparationMode": "",
        "preparationLeadTimeDays": "",
        "shelfLifeRoom": "",
        "shelfLifeRefrigerated": "",
        "shelfLifeFrozen": "",
        "productionCenters": [],
        "supplyRoutes": [],
        "ingredients": [
            {
                "id": ingredient_id,
                "productId": product["id"],
                "productLabel": product["name"],
                "quantity": number_text(DOSE_VOLUME_ML),
                "yieldQuantity": number_text(DOSE_VOLUME_ML),
                "operationalUnit": "",
                "manipulatedQuantity": "",
                "operationalQuantity": "",
                "isActive": True,
            }
        ],
        "garnishIngredients": [],
        "serviceItems": [],
        "isActive": True,
    }


def build_linked_product(sheet: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": sheet["productId"],
        "companyId": sheet["companyId"],
        "ownerCompanyId": sheet["ownerCompanyId"],
        "companyProductId": sheet.get("companyProductId") or "",
        "name": sheet["name"],
        "controlUnit": sheet["outputUnit"],
        "family": sheet.get("family") or "",
        "subfamily": sheet.get("subfamily") or "",
        "sectors": sheet.get("sectors") or [],
        "alcoholPercentage": "",
        "densitySampleVolume": "",
        "densitySampleWeight": "",
        "ignoreStock": False,
        "excludeFromExecutionYield": False,
        "isActive": True,
        "technicalSheetId": sheet["id"],
        "packages": [],
    }


def backup_online(timestamp: str) -> Path:
    target = BACKUP_ROOT / f"online-before-madre-20260906-padro-vermouths-doses-{timestamp}"
    target.mkdir(parents=True, exist_ok=True)
    for endpoint, key, filename in [
        ("/products", "products", "products.json"),
        ("/technical-sheets", "technicalSheets", "technical-sheets.json"),
    ]:
        data = api_json(endpoint, params={"companyId": COMPANY_ID})[key]
        (target / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy2(PRICE_WORKBOOK, target / PRICE_WORKBOOK.name)
    return target


def build_rows(products: list[dict[str, Any]], sheets: list[dict[str, Any]], price_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in PHOTO_ITEMS:
        price_sheet_match = find_price_sheet_match(item, price_rows)
        product = find_existing_product(item, products)
        item_cost = final_cost(item)
        sale_name = f"DS {item['product_name']} 60ML"
        sale_price = suggested_sale_price(item_cost, item["volume_ml"], item.get("sale_price"))
        dose_cost = (item_cost / item["volume_ml"]) * DOSE_VOLUME_ML
        cmv = (dose_cost / sale_price) * Decimal("100")
        row = {
            **copy.deepcopy(item),
            "price_sheet_match": price_sheet_match,
            "existing_product": product,
            "product_id": product.get("id") if product else "",
            "sale_name": sale_name,
            "final_cost": item_cost,
            "dose_cost": dose_cost,
            "sale_price": sale_price,
            "cmv": cmv,
            "status": "PENDENTE",
            "sheet_id": "",
            "sheet_product_id": "",
        }
        if product:
            existing_sheet = find_existing_dose_sheet(product["id"], sale_name, sheets)
            if existing_sheet:
                row["status"] = "FEITO_JA_EXISTIA"
                row["sheet_id"] = existing_sheet.get("id")
                row["sheet_product_id"] = existing_sheet.get("productId")
        rows.append(row)
    return rows


def apply_rows(rows: list[dict[str, Any]], products: list[dict[str, Any]], sheets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for row in rows:
        if row["status"] == "FEITO_JA_EXISTIA":
            continue
        product = row["existing_product"]
        if not product:
            product = api_json("/products", "POST", build_product_payload(row))["product"]
            row["existing_product"] = product
            row["product_id"] = product["id"]
            row["status"] = "PRODUTO_CRIADO"
            products.append(product)
        pkg_cost = package_cost(product) or row["final_cost"]
        pkg_ml = package_ml(product) or row["volume_ml"]
        dose_cost = (pkg_cost / pkg_ml) * DOSE_VOLUME_ML
        sale_price = suggested_sale_price(pkg_cost, pkg_ml, row.get("sale_price"))
        cmv = (dose_cost / sale_price) * Decimal("100")
        sale_name = f"DS {product['name']} 60ML"
        existing_sheet = find_existing_dose_sheet(product["id"], sale_name, sheets)
        if existing_sheet:
            row["status"] = f"{row['status']}_FICHA_JA_EXISTIA"
            row["sale_name"] = existing_sheet["name"]
            row["sheet_id"] = existing_sheet.get("id")
            row["sheet_product_id"] = existing_sheet.get("productId")
            continue
        saved_sheet = api_json("/technical-sheets", "POST", build_sheet_payload(product, sale_name, sale_price, cmv))[
            "technicalSheet"
        ]
        api_json("/products", "POST", build_linked_product(saved_sheet))
        sheets.append(saved_sheet)
        row["sale_name"] = saved_sheet["name"]
        row["sheet_id"] = saved_sheet.get("id")
        row["sheet_product_id"] = saved_sheet.get("productId")
        row["dose_cost"] = dose_cost
        row["sale_price"] = sale_price
        row["cmv"] = cmv
        row["status"] = f"{row['status']}_FICHA_CRIADA"
    return rows


def write_output_workbook(rows: list[dict[str, Any]], timestamp: str) -> None:
    if OUTPUT_WORKBOOK.exists():
        backup = OUTPUT_WORKBOOK.with_name(f"{OUTPUT_WORKBOOK.stem}.backup-{timestamp}{OUTPUT_WORKBOOK.suffix}")
        shutil.copy2(OUTPUT_WORKBOOK, backup)
    workbook = Workbook()
    ws = workbook.active
    ws.title = "Custos doses 60ml"
    headers = [
        "Foto",
        "Nome bebida",
        "ID produto base",
        "Produto ja existia",
        "Moeda origem",
        "Valor compra moeda origem",
        "Cotacao usada",
        "IOF %",
        "Valor convertido R$",
        "Valor IOF R$",
        "Outros impostos R$",
        "Outros valores inclusos R$",
        "Valor final custo R$",
        "Volume embalagem ml",
        "Custo dose 60ml R$",
        "Sugestao preco venda dose R$",
        "CMV final %",
        "ID ficha venda",
        "ID produto ficha venda",
        "Status",
        "Fonte custo",
        "Fonte dados",
        "Encontrado na Lista de preços Bar.xlsx",
    ]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row_index, row in enumerate(rows, start=2):
        ws.append(
            [
                row["photo"],
                row["product_name"],
                row["product_id"],
                "SIM" if row["existing_product"] else "NAO",
                row["currency"],
                float(row["source_value"]),
                float(row["exchange_rate"]),
                float(row["iof_percent"]),
                None,
                None,
                0,
                0,
                None,
                float(row["volume_ml"]),
                None,
                float(row["sale_price"]),
                None,
                row["sheet_id"],
                row["sheet_product_id"],
                row["status"],
                row["cost_source"],
                row["data_source"],
                (
                    f"{row['price_sheet_match']['_sheet']} linha {row['price_sheet_match']['_row']}: "
                    f"{row['price_sheet_match'].get('Item')} = {row['price_sheet_match'].get('Valor')}"
                    if row.get("price_sheet_match")
                    else "NAO"
                ),
            ]
        )
        ws.cell(row_index, 9, f"=F{row_index}*G{row_index}")
        ws.cell(row_index, 10, f"=I{row_index}*(H{row_index}/100)")
        ws.cell(row_index, 13, f"=I{row_index}+J{row_index}+K{row_index}+L{row_index}")
        ws.cell(row_index, 15, f"=M{row_index}/N{row_index}*60")
        ws.cell(row_index, 17, f"=O{row_index}/P{row_index}")
    for column in range(1, len(headers) + 1):
        ws.column_dimensions[ws.cell(1, column).column_letter].width = min(
            max(len(str(ws.cell(1, column).value)) + 2, 14),
            55,
        )
    for row in ws.iter_rows(min_row=2, min_col=6, max_col=17):
        for cell in row:
            if cell.column in {6, 7, 9, 10, 11, 12, 13, 15, 16}:
                cell.number_format = 'R$ #,##0.00'
            elif cell.column == 17:
                cell.number_format = '0.00%'

    source_ws = workbook.create_sheet("Fontes")
    source_ws.append(["Bebida", "Fonte", "Uso"])
    for cell in source_ws[1]:
        cell.font = Font(bold=True)
    for row in rows:
        for source_url in row["source_urls"]:
            source_ws.append([row["product_name"], source_url, "preco/dados de produto"])
    source_ws.column_dimensions["A"].width = 45
    source_ws.column_dimensions["B"].width = 90
    source_ws.column_dimensions["C"].width = 30
    workbook.save(OUTPUT_WORKBOOK)


def verify(rows: list[dict[str, Any]]) -> dict[str, Any]:
    products = api_json("/products", params={"companyId": COMPANY_ID})["products"]
    sheets = api_json("/technical-sheets", params={"companyId": COMPANY_ID})["technicalSheets"]
    product_by_id = {product.get("id"): product for product in products}
    sheet_by_id = {sheet.get("id"): sheet for sheet in sheets}
    missing_products = [row["product_id"] for row in rows if row["product_id"] not in product_by_id]
    missing_sheets = [row["sheet_id"] for row in rows if row["sheet_id"] not in sheet_by_id]
    bad_ingredients: list[dict[str, Any]] = []
    bad_costs: list[dict[str, Any]] = []
    for row in rows:
        product = product_by_id.get(row["product_id"])
        sheet = sheet_by_id.get(row["sheet_id"])
        if product and package_cost(product) != row["final_cost"]:
            bad_costs.append({"productId": row["product_id"], "expected": str(row["final_cost"]), "actual": str(package_cost(product))})
        if not sheet:
            continue
        if not any(
            ingredient.get("productId") == row["product_id"]
            and ingredient.get("isActive") is True
            and decimal_from(ingredient.get("quantity")) == DOSE_VOLUME_ML
            for ingredient in sheet.get("ingredients") or []
        ):
            bad_ingredients.append({"sheetId": row["sheet_id"], "productId": row["product_id"]})
    return {
        "productsAfter": len(products),
        "technicalSheetsAfter": len(sheets),
        "missingProducts": missing_products,
        "missingSheets": missing_sheets,
        "badIngredients": bad_ingredients,
        "badCosts": bad_costs,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    timestamp = time.strftime("%Y%m%d-%H%M%S")
    products = api_json("/products", params={"companyId": COMPANY_ID})["products"]
    sheets = api_json("/technical-sheets", params={"companyId": COMPANY_ID})["technicalSheets"]
    price_rows = read_price_sheet_rows()
    rows = build_rows(products, sheets, price_rows)

    if args.apply:
        backup_dir = backup_online(timestamp)
        rows = apply_rows(rows, products, sheets)
    else:
        backup_dir = None
        for row in rows:
            if row["status"] == "PENDENTE":
                row["status"] = "CRIARIA_PRODUTO_E_FICHA"

    write_output_workbook(rows, timestamp)
    AUDIT_ROOT.mkdir(parents=True, exist_ok=True)
    audit_path = AUDIT_ROOT / f"madre-20260906-padro-vermouths-doses-{timestamp}.json"
    audit = {
        "apply": args.apply,
        "backupDir": str(backup_dir) if backup_dir else "",
        "outputWorkbook": str(OUTPUT_WORKBOOK),
        "rows": rows,
        "verification": verify(rows) if args.apply else {},
    }
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()

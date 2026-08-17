#!/usr/bin/env python3
"""Create missing VENDA sheets for Madre closed beverages.

Idempotent: if a VENDA sheet already consumes the target product, it is reused.
The server allocates the technical sheet id and linked VEN-* product id.
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from madre_demand_projection_dry_run import (
    DEFAULT_API_BASE,
    DEFAULT_COMPANY_ID,
    format_decimal,
    normalize_text,
    package_quantity,
    preferred_package,
    product_visible_for_company,
    sheet_visible_for_company,
)


SALE_SHEET_SPECS = [
    ("COCA LATA", "COCA COLA LATA"),
    ("COCA ZERO LATA", "COCA COLA ZERO LATA"),
    ("GUARANA LATA", "GUARANA ANTARCTICA LATA"),
    ("GUARANA ZERO LATA", "GUARANA ANTARCTICA ZERO LATA"),
    ("CORONA", "CORONA EXTRA LONG NECK"),
    ("AGUA SEM GAS", "AGUA PRATA SEM GAS RETORNAVEL"),
    ("AGUA COM GAS", "AGUA PRATA COM GAS RETORNAVEL"),
]


def api_request(api_base: str, method: str, path: str, payload: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = api_base.rstrip("/") + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def get(api_base: str, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return api_request(api_base, "GET", path, params=params)


def post(api_base: str, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    return api_request(api_base, "POST", path, payload=payload)


def resolve_product(name: str, products: List[Dict[str, Any]], company_id: int) -> Dict[str, Any]:
    matches = [
        product
        for product in products
        if product.get("isActive") is True
        and product_visible_for_company(product, company_id)
        and normalize_text(product.get("name")) == normalize_text(name)
    ]
    if len(matches) != 1:
        raise RuntimeError(f"Produto nao resolvido de forma unica: {name} ({len(matches)} matches)")
    return matches[0]


def find_existing_sale_sheet_for_product(product_id: str, sheets: List[Dict[str, Any]], company_id: int) -> Optional[Dict[str, Any]]:
    matches = [
        sheet
        for sheet in sheets
        if sheet.get("kind") == "VENDA"
        and sheet.get("isActive") is True
        and sheet_visible_for_company(sheet, company_id)
        and any(
            ingredient.get("isActive") is True and ingredient.get("productId") == product_id
            for ingredient in (sheet.get("ingredients") or []) + (sheet.get("garnishIngredients") or [])
        )
    ]
    matches.sort(key=lambda item: item.get("id") or 0)
    return matches[0] if matches else None


def build_sale_sheet_payload(company_id: int, sale_name: str, product: Dict[str, Any], ingredient_quantity: float) -> Dict[str, Any]:
    family = product.get("family") or "BEBIDAS"
    subfamily = product.get("subfamily") or ""
    sectors = product.get("sectors") or []
    quantity = format_decimal(ingredient_quantity)
    return {
        "id": 0,
        "companyId": company_id,
        "ownerCompanyId": company_id,
        "sharedCompanyIds": [],
        "kind": "VENDA",
        "productId": "",
        "companyProductId": "",
        "companyProductIdsByCompanyId": {},
        "name": sale_name,
        "family": family,
        "subfamily": subfamily,
        "sectors": sectors,
        "outputQuantity": quantity,
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
        "desiredCmvPercentage": "100",
        "dilutionRatePercentage": "",
        "imageDataUrl": "",
        "finalSalePrice": "0",
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
                "id": 1,
                "productId": product["id"],
                "productLabel": product["name"],
                "quantity": quantity,
                "operationalQuantity": "",
                "operationalUnit": "",
                "manipulatedQuantity": "",
                "yieldQuantity": quantity,
                "isActive": True,
            }
        ],
        "garnishIngredients": [],
        "serviceItems": [],
        "isActive": True,
    }


def build_linked_product_payload(sheet: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "companyId": sheet["companyId"],
        "ownerCompanyId": sheet["ownerCompanyId"],
        "id": sheet["productId"],
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
        "packages": [],
        "technicalSheetId": sheet["id"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Ensure Madre closed beverage VENDA sheets.")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--company-id", type=int, default=DEFAULT_COMPANY_ID)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    products = get(args.api_base, "/products", {"companyId": args.company_id}).get("products", [])
    sheets = get(args.api_base, "/technical-sheets", {"companyId": args.company_id}).get("technicalSheets", [])

    results: List[Tuple[str, str, str]] = []
    for sale_name, product_name in SALE_SHEET_SPECS:
        product = resolve_product(product_name, products, args.company_id)
        existing = find_existing_sale_sheet_for_product(product["id"], sheets, args.company_id)
        if existing:
            results.append((sale_name, "exists", f"{existing['id']} {existing['productId']}"))
            continue
        package = preferred_package(product)
        normalized_quantity = package_quantity(package, product.get("controlUnit") or "") if package else 0
        if normalized_quantity <= 0:
            raise RuntimeError(f"Produto sem embalagem normalizada: {product_name}")
        if not args.apply:
            results.append((sale_name, "would_create", f"{product['id']} {format_decimal(normalized_quantity)}"))
            continue
        sheet_payload = build_sale_sheet_payload(args.company_id, sale_name, product, normalized_quantity)
        saved_sheet = post(args.api_base, "/technical-sheets", sheet_payload)["technicalSheet"]
        linked_product = build_linked_product_payload(saved_sheet)
        post(args.api_base, "/products", linked_product)
        sheets.append(saved_sheet)
        products.append(linked_product)
        results.append((sale_name, "created", f"{saved_sheet['id']} {saved_sheet['productId']}"))

    for name, status, detail in results:
        print(f"{status}: {name} -> {detail}")


if __name__ == "__main__":
    main()

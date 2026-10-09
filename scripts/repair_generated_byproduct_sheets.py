#!/usr/bin/env python3
"""Audita e corrige fichas de subproduto gerado por outra ficha.

Uso:
  GESTOR_SYSTEM_ADMIN_PASSWORD=... python scripts/repair_generated_byproduct_sheets.py --dry-run
  GESTOR_SYSTEM_ADMIN_PASSWORD=... python scripts/repair_generated_byproduct_sheets.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.request
from copy import deepcopy
from pathlib import Path
from typing import Any


API_BASE = os.environ.get("GESTOR_API_BASE", "https://gestor-estoque-zqw9.onrender.com/api").rstrip("/")
USERNAME = os.environ.get("GESTOR_SYSTEM_ADMIN_USERNAME", "igarape.aeb")
PASSWORD = os.environ.get("GESTOR_SYSTEM_ADMIN_PASSWORD", "")
MADRE_COMPANY_ID = 13
BACKUP_ROOT = Path("backups")
AUDIT_ROOT = Path("auditorias")


def fail(message: str) -> None:
    raise SystemExit(f"ERRO: {message}")


def request_json(path: str, method: str = "GET", payload: Any | None = None, token: str | None = None) -> Any:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"{API_BASE}{path}", data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = response.read().decode("utf-8")
            return json.loads(data) if data else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} -> HTTP {error.code}: {detail}") from error


def login() -> str:
    if not PASSWORD:
        fail("Defina GESTOR_SYSTEM_ADMIN_PASSWORD para executar contra a API protegida.")
    payload = request_json("/auth/login", "POST", {"username": USERNAME, "password": PASSWORD})
    token = payload.get("token")
    if not isinstance(token, str) or not token:
        fail("Login nao retornou token.")
    return token


def norm(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"[^A-Z0-9]+", " ", text.upper()).strip()


def fetch_all(token: str) -> dict[str, Any]:
    return {
        "technicalSheets": request_json("/technical-sheets", token=token)["technicalSheets"],
        "products": request_json("/products", token=token)["products"],
    }


def active_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [item for item in items if item.get("isActive") is True]


def linked_product(sheet: dict[str, Any], products: list[dict[str, Any]]) -> dict[str, Any] | None:
    return next((product for product in products if product.get("technicalSheetId") == sheet["id"]), None)


def put_sheet(token: str, sheet: dict[str, Any]) -> dict[str, Any]:
    return request_json(f"/technical-sheets/{sheet['id']}", "PUT", sheet, token=token)["technicalSheet"]


def put_product(token: str, product: dict[str, Any]) -> dict[str, Any]:
    return request_json(f"/products/{product['id']}", "PUT", product, token=token)["product"]


def find_sheet_by_name(sheets: list[dict[str, Any]], name: str, company_id: int) -> dict[str, Any] | None:
    name_key = norm(name)
    matches = [
        sheet
        for sheet in sheets
        if norm(sheet.get("name", "")) == name_key
        and (
            sheet.get("ownerCompanyId") == company_id
            or sheet.get("companyId") == company_id
            or company_id in (sheet.get("sharedCompanyIds") or [])
        )
    ]
    if not matches:
        return None
    return sorted(matches, key=lambda item: (item.get("ownerCompanyId") != company_id, item["id"]))[0]


def make_generated_byproduct_sheet(sheet: dict[str, Any], source_sheet: dict[str, Any]) -> dict[str, Any]:
    next_sheet = deepcopy(sheet)
    next_sheet["ingredients"] = []
    next_sheet["garnishIngredients"] = []
    next_sheet["productionCenters"] = []
    next_sheet["supplyRoutes"] = []
    next_sheet["preparationMode"] = (
        f"SUBPRODUTO GERADO NA PRODUCAO DE {source_sheet.get('name', 'FICHA GERADORA')}. "
        "CONFIRMAR A QUANTIDADE REAL GERADA AO FINALIZAR A PRODUCAO."
    )
    return next_sheet


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    apply = bool(args.apply)
    if args.dry_run:
        apply = False

    token = login()
    data = fetch_all(token)
    sheets = data["technicalSheets"]
    products = data["products"]
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    BACKUP_ROOT.mkdir(exist_ok=True)
    AUDIT_ROOT.mkdir(exist_ok=True)
    backup_path = BACKUP_ROOT / f"generated-byproducts-before-{'apply' if apply else 'dry-run'}-{stamp}.json"
    backup_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    sheet_by_id = {sheet["id"]: sheet for sheet in sheets}
    actions: list[dict[str, Any]] = []

    tomato_source = find_sheet_by_name(sheets, "SUMO DE TOMATE FILTRADO", MADRE_COMPANY_ID)
    tomato_byproduct = find_sheet_by_name(sheets, "BAGACO DE TOMATE DO CORDIAL", MADRE_COMPANY_ID)
    if tomato_source and tomato_byproduct:
        next_source = deepcopy(tomato_source)
        next_source["yieldDifferenceDestination"] = "BYPRODUCT"
        next_source["yieldDifferenceByproductName"] = tomato_byproduct["name"]
        next_source["yieldDifferenceByproductTechnicalSheetId"] = tomato_byproduct["id"]
        if next_source != tomato_source:
            actions.append({"type": "link_tomato_byproduct", "sheet": next_source})

        next_byproduct = make_generated_byproduct_sheet(tomato_byproduct, next_source)
        next_byproduct["outputQuantity"] = "250"
        next_byproduct["outputUnit"] = "GRAM"
        if next_byproduct != tomato_byproduct:
            actions.append({"type": "repair_tomato_byproduct_sheet", "sheet": next_byproduct})
    else:
        actions.append(
            {
                "type": "warning",
                "message": "Nao encontrei SUMO DE TOMATE FILTRADO e/ou BAGACO DE TOMATE DO CORDIAL na Casa de Mi Madre.",
            }
        )

    linked_byproduct_ids = {
        sheet.get("yieldDifferenceByproductTechnicalSheetId"): sheet
        for sheet in sheets
        if sheet.get("kind") == "PREPARO"
        and sheet.get("yieldDifferenceDestination") == "BYPRODUCT"
        and isinstance(sheet.get("yieldDifferenceByproductTechnicalSheetId"), int)
    }
    for byproduct_id, source_sheet in sorted(linked_byproduct_ids.items()):
        byproduct_sheet = sheet_by_id.get(byproduct_id)
        if not byproduct_sheet:
            actions.append(
                {
                    "type": "missing_linked_byproduct_sheet",
                    "sourceSheetId": source_sheet["id"],
                    "sourceSheetName": source_sheet["name"],
                    "byproductSheetId": byproduct_id,
                }
            )
            continue
        needs_repair = (
            len(active_items(byproduct_sheet.get("ingredients") or [])) > 0
            or len(active_items(byproduct_sheet.get("garnishIngredients") or [])) > 0
            or len(byproduct_sheet.get("productionCenters") or []) > 0
            or len(byproduct_sheet.get("supplyRoutes") or []) > 0
        )
        if needs_repair and not any(
            action.get("type") == "repair_tomato_byproduct_sheet" and action["sheet"]["id"] == byproduct_sheet["id"]
            for action in actions
        ):
            actions.append({"type": "repair_linked_byproduct_sheet", "sheet": make_generated_byproduct_sheet(byproduct_sheet, source_sheet)})

    product_actions: list[dict[str, Any]] = []
    sheet_actions = [action for action in actions if action.get("sheet")]
    for action in sheet_actions:
        sheet = action["sheet"]
        product = linked_product(sheet, products)
        if not product:
            continue
        next_product = deepcopy(product)
        next_product["controlUnit"] = sheet["outputUnit"]
        next_product["ignoreStock"] = False
        next_product["isActive"] = True
        if next_product != product:
            product_actions.append({"type": "repair_linked_product", "product": next_product, "sheetId": sheet["id"]})

    applied: list[dict[str, Any]] = []
    if apply:
        for action in sheet_actions:
            saved = put_sheet(token, action["sheet"])
            applied.append({"type": action["type"], "sheetId": saved["id"], "sheetName": saved["name"]})
        for action in product_actions:
            saved = put_product(token, action["product"])
            applied.append({"type": action["type"], "productId": saved["id"], "productName": saved["name"], "sheetId": action["sheetId"]})

    audit = {
        "apply": apply,
        "apiBase": API_BASE,
        "backupPath": str(backup_path),
        "sheetActionCount": len(sheet_actions),
        "productActionCount": len(product_actions),
        "warnings": [action for action in actions if not action.get("sheet")],
        "sheetActions": [
            {
                "type": action["type"],
                "sheetId": action["sheet"]["id"],
                "sheetName": action["sheet"]["name"],
                "ingredients": len(action["sheet"].get("ingredients") or []),
                "productionCenters": len(action["sheet"].get("productionCenters") or []),
                "outputQuantity": action["sheet"].get("outputQuantity"),
                "outputUnit": action["sheet"].get("outputUnit"),
            }
            for action in sheet_actions
        ],
        "productActions": [
            {
                "type": action["type"],
                "productId": action["product"]["id"],
                "productName": action["product"]["name"],
                "sheetId": action["sheetId"],
                "controlUnit": action["product"]["controlUnit"],
            }
            for action in product_actions
        ],
        "applied": applied,
    }
    audit_path = AUDIT_ROOT / f"generated-byproducts-{'apply' if apply else 'dry-run'}-{stamp}.json"
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
import argparse
import copy
import datetime as dt
import json
import math
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


API_BASE = os.environ.get("GESTOR_API_BASE", "https://gestor-estoque-zqw9.onrender.com/api").rstrip("/")

CPXVA_COMPANY_ID = 2
MACAXEIRA_COMPANY_ID = 5
LAB_CENTER_ID = 1
MAC_BAR_CENTER_IDS = [10, 11, 12]

XAROPE_CAJA_SHEET_ID = 79
MACA_GRANNY_SHEET_ID = 113
PINDORAMA_CPXVA_SHEET_ID = 335
PURE_GOIABA_CPXVA_SHEET_ID = 476
PINDORAMA_MAC_SHEET_ID = 826
PURE_GOIABA_MAC_SHEET_ID = 828


def request_json(method, path, body=None, headers=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    request_headers = {"Content-Type": "application/json"} if data is not None else {}
    request_headers.update(headers or {})
    request = urllib.request.Request(
        f"{API_BASE}{path}",
        data=data,
        method=method,
        headers=request_headers,
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: HTTP {exc.code}: {detail}") from exc


def read_collection(path, key):
    payload = request_json("GET", path)
    return payload if isinstance(payload, list) else payload.get(key, [])


def parse_decimal(value):
    if value is None:
        return None
    compact = str(value).replace(" ", "").strip()
    if not compact:
        return None
    normalized = compact
    if "," in compact and "." in compact:
        normalized = compact.replace(".", "").replace(",", ".")
    elif "," in compact:
        normalized = compact.replace(",", ".")
    elif re.match(r"^\d{1,3}(\.\d{3})+$", compact):
        normalized = compact.replace(".", "")
    try:
        parsed = float(normalized)
    except ValueError:
        return None
    return parsed if math.isfinite(parsed) else None


def format_decimal(value):
    rounded = round(float(value) + 1e-9, 2)
    if abs(rounded - round(rounded)) < 1e-9:
        return f"{int(round(rounded)):,}".replace(",", ".")
    whole, frac = f"{rounded:,.2f}".split(".")
    return f"{whole.replace(',', '.')},{frac}"


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def max_int_id(records):
    ids = [int(record["id"]) for record in records if isinstance(record.get("id"), int)]
    return max(ids) if ids else 0


def load_state():
    sheet_ids = [
        XAROPE_CAJA_SHEET_ID,
        MACA_GRANNY_SHEET_ID,
        PINDORAMA_CPXVA_SHEET_ID,
        PURE_GOIABA_CPXVA_SHEET_ID,
        PINDORAMA_MAC_SHEET_ID,
        PURE_GOIABA_MAC_SHEET_ID,
    ]
    technical_sheets = {
        sheet_id: request_json("GET", f"/technical-sheets/{sheet_id}")["technicalSheet"]
        for sheet_id in sheet_ids
    }
    state = {
        "technicalSheets": technical_sheets,
        "macaxeiraTechnicalSheets": read_collection(
            f"/technical-sheets?companyId={MACAXEIRA_COMPANY_ID}",
            "technicalSheets",
        ),
        "stockCenters": read_collection("/stock-centers", "stockCenters"),
        "products": read_collection(f"/products?companyId={MACAXEIRA_COMPANY_ID}", "products"),
        "auditLogs": read_collection("/audit-logs", "auditLogs"),
    }
    return state


def save_backup(state):
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = f"backups/online-before-macaxeira-production-routing-cases-{stamp}"
    os.makedirs(backup_dir, exist_ok=True)
    for key, value in state.items():
        with open(os.path.join(backup_dir, f"{key}.json"), "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
    return backup_dir


def build_audit_log(log_id, company_id, target_type, target_id, target_label, action_key, summary, details):
    return {
        "id": log_id,
        "companyId": company_id,
        "actorUserId": None,
        "actorUserName": "Igarape A&B Master",
        "actorUsername": "igarape.aeb",
        "actorRole": "MASTER",
        "actorKind": "SYSTEM_ADMIN",
        "module": "FICHAS",
        "actionKey": action_key,
        "actionLabel": "Correcao de roteamento de producao",
        "targetType": target_type,
        "targetId": str(target_id),
        "targetLabel": target_label,
        "summary": summary,
        "impactSummary": "Cadastro ajustado para que a fila de producao e as requisicoes futuras sigam o centro produtor correto.",
        "severity": "HIGH",
        "result": "SUCCESS",
        "relatedCompanyIds": [MACAXEIRA_COMPANY_ID] if company_id == CPXVA_COMPANY_ID else [CPXVA_COMPANY_ID],
        "details": details,
        "occurredAt": now_iso(),
    }


def add_lab_to_xarope(state):
    sheet = copy.deepcopy(state["technicalSheets"][XAROPE_CAJA_SHEET_ID])
    previous_centers = copy.deepcopy(sheet.get("productionCenters") or [])
    production_centers = list(previous_centers)
    if not any(int(item.get("stockCenterId") or 0) == LAB_CENTER_ID for item in production_centers):
        production_centers.insert(0, {"stockCenterId": LAB_CENTER_ID, "minimumQuantity": ""})
    sheet["productionCenters"] = production_centers

    lab_before = next(center for center in state["stockCenters"] if center["id"] == LAB_CENTER_ID)
    lab_after = copy.deepcopy(lab_before)
    produced_ids = set(lab_after.get("producedTechnicalSheetIds") or [])
    produced_ids.add(XAROPE_CAJA_SHEET_ID)
    lab_after["producedTechnicalSheetIds"] = sorted(produced_ids)

    changed = sheet != state["technicalSheets"][XAROPE_CAJA_SHEET_ID] or lab_after != lab_before
    return {
        "changed": changed,
        "sheetBefore": state["technicalSheets"][XAROPE_CAJA_SHEET_ID],
        "sheetAfter": sheet,
        "centerBefore": lab_before,
        "centerAfter": lab_after,
        "details": {
            "sheetId": XAROPE_CAJA_SHEET_ID,
            "sheetName": sheet["name"],
            "previousProductionCenters": previous_centers,
            "nextProductionCenters": sheet["productionCenters"],
            "stockCenterId": LAB_CENTER_ID,
            "addedToProducedTechnicalSheetIds": XAROPE_CAJA_SHEET_ID not in (lab_before.get("producedTechnicalSheetIds") or []),
        },
    }


def copy_maca_ingredient_to_pindorama(state):
    source = state["technicalSheets"][PINDORAMA_CPXVA_SHEET_ID]
    maca = state["technicalSheets"][MACA_GRANNY_SHEET_ID]
    target_before = state["technicalSheets"][PINDORAMA_MAC_SHEET_ID]
    target_after = copy.deepcopy(target_before)
    source_ingredient = next(
        item
        for item in source.get("ingredients", [])
        if item.get("productId") == maca.get("productId") and item.get("isActive") is not False
    )

    already_active = any(
        item.get("productId") == maca.get("productId") and item.get("isActive") is not False
        for item in target_after.get("ingredients", [])
    )
    changed_item = None
    if not already_active:
        reusable = next(
            (
                item
                for item in target_after.get("ingredients", [])
                if item.get("productLabel") == maca.get("name") and item.get("isActive") is False
            ),
            None,
        )
        next_item = copy.deepcopy(source_ingredient)
        next_item["productId"] = maca["productId"]
        next_item["productLabel"] = maca["name"]
        next_item["isActive"] = True
        if reusable:
            next_item["id"] = reusable.get("id")
            target_after["ingredients"] = [
                next_item if item.get("id") == reusable.get("id") else item
                for item in target_after.get("ingredients", [])
            ]
        else:
            existing_ids = [
                int(item.get("id"))
                for item in target_after.get("ingredients", [])
                if isinstance(item.get("id"), int)
            ]
            next_item["id"] = max(existing_ids + [int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)]) + 1
            target_after["ingredients"] = [*(target_after.get("ingredients") or []), next_item]
        changed_item = next_item

    return {
        "changed": target_after != target_before,
        "sheetBefore": target_before,
        "sheetAfter": target_after,
        "details": {
            "sourceSheetId": PINDORAMA_CPXVA_SHEET_ID,
            "targetSheetId": PINDORAMA_MAC_SHEET_ID,
            "dependencySheetId": MACA_GRANNY_SHEET_ID,
            "dependencyProductId": maca["productId"],
            "alreadyActive": already_active,
            "ingredientApplied": changed_item,
        },
    }


def replace_product_in_ingredients(sheet, old_product_id, new_product_id, new_label):
    changed = False
    next_sheet = copy.deepcopy(sheet)
    for field in ["ingredients", "garnishIngredients"]:
        items = next_sheet.get(field) or []
        for item in items:
            if item.get("productId") == old_product_id and item.get("isActive") is not False:
                item["productId"] = new_product_id
                item["productLabel"] = new_label
                changed = True
    return changed, next_sheet


def merge_or_replace_minimums(entries, old_sheet, new_sheet):
    next_entries = []
    migrated = []
    has_new_entry = any(
        entry.get("kind") == "PREPARO"
        and entry.get("technicalSheetId") == new_sheet["id"]
        and entry.get("productId") == new_sheet["productId"]
        for entry in entries or []
    )
    for entry in entries or []:
        if entry.get("kind") == "PREPARO" and (
            entry.get("technicalSheetId") == old_sheet["id"] or entry.get("productId") == old_sheet["productId"]
        ):
            if has_new_entry:
                migrated.append({"before": entry, "after": None})
                continue
            replacement = copy.deepcopy(entry)
            replacement["technicalSheetId"] = new_sheet["id"]
            replacement["productId"] = new_sheet["productId"]
            migrated.append({"before": entry, "after": replacement})
            next_entries.append(replacement)
        else:
            next_entries.append(entry)
    return next_entries, migrated


def fix_pure_goiaba_duplicate(state):
    old_sheet = state["technicalSheets"][PURE_GOIABA_MAC_SHEET_ID]
    new_sheet = state["technicalSheets"][PURE_GOIABA_CPXVA_SHEET_ID]
    changed_sheets = []
    for sheet in state["macaxeiraTechnicalSheets"]:
        if not sheet.get("isActive"):
            continue
        changed, next_sheet = replace_product_in_ingredients(
            sheet,
            old_sheet["productId"],
            new_sheet["productId"],
            new_sheet["name"],
        )
        if changed:
            changed_sheets.append({"before": sheet, "after": next_sheet})

    old_sheet_after = copy.deepcopy(old_sheet)
    old_sheet_after["isActive"] = False
    old_sheet_after["productionCenters"] = []

    changed_centers = []
    for center in state["stockCenters"]:
        next_center = copy.deepcopy(center)
        produced_ids = [sheet_id for sheet_id in next_center.get("producedTechnicalSheetIds") or [] if sheet_id != old_sheet["id"]]
        if produced_ids != (next_center.get("producedTechnicalSheetIds") or []):
            next_center["producedTechnicalSheetIds"] = produced_ids
        next_minimums, migrated = merge_or_replace_minimums(next_center.get("minimumStocks") or [], old_sheet, new_sheet)
        if migrated:
            next_center["minimumStocks"] = next_minimums
        if next_center != center:
            changed_centers.append({"before": center, "after": next_center, "migratedMinimums": migrated})

    product_before = next((product for product in state["products"] if product.get("id") == old_sheet["productId"]), None)
    product_after = copy.deepcopy(product_before) if product_before else None
    if product_after:
        product_after["isActive"] = False
        product_after["name"] = "PURE GOIABA - DUPLICADO INATIVO MACAXEIRA"

    return {
        "changed": bool(changed_sheets) or old_sheet_after != old_sheet or bool(changed_centers) or product_after != product_before,
        "changedIngredientSheets": changed_sheets,
        "oldSheetBefore": old_sheet,
        "oldSheetAfter": old_sheet_after,
        "changedCenters": changed_centers,
        "productBefore": product_before,
        "productAfter": product_after,
        "details": {
            "oldSheetId": old_sheet["id"],
            "oldProductId": old_sheet["productId"],
            "newSheetId": new_sheet["id"],
            "newProductId": new_sheet["productId"],
            "changedIngredientSheetIds": [item["after"]["id"] for item in changed_sheets],
            "changedCenterIds": [item["after"]["id"] for item in changed_centers],
            "migratedMinimums": [
                {
                    "stockCenterId": item["after"]["id"],
                    "stockCenterName": item["after"]["name"],
                    "count": len(item["migratedMinimums"]),
                }
                for item in changed_centers
                if item["migratedMinimums"]
            ],
            "productInactivated": bool(product_before and product_after != product_before),
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    state = load_state()
    backup_dir = save_backup(state)
    xarope_change = add_lab_to_xarope(state)
    pindorama_change = copy_maca_ingredient_to_pindorama(state)
    pure_change = fix_pure_goiaba_duplicate(state)

    audit_logs = []
    next_log_id = max_int_id(state["auditLogs"]) + 1
    if xarope_change["changed"]:
        audit_logs.append(
            build_audit_log(
                next_log_id,
                CPXVA_COMPANY_ID,
                "TECHNICAL_SHEET",
                XAROPE_CAJA_SHEET_ID,
                "XAROPE DE CAJA 53.5",
                "FIX_XAROPE_CAJA_LAB_PRODUCER",
                "LABORATORIO foi adicionado como centro produtor de XAROPE DE CAJA 53.5, mantendo os centros Macaxeira.",
                xarope_change["details"],
            )
        )
        next_log_id += 1
    if pindorama_change["changed"]:
        audit_logs.append(
            build_audit_log(
                next_log_id,
                MACAXEIRA_COMPANY_ID,
                "TECHNICAL_SHEET",
                PINDORAMA_MAC_SHEET_ID,
                "PINDORAMA PRE-BATCHED",
                "FIX_PINDORAMA_MAC_MACA_DEPENDENCY",
                "Ingrediente MACA VERDE GRANNY SMITH CLARIFICADO foi reativado/corrigido na ficha Macaxeira de PINDORAMA PRE-BATCHED.",
                pindorama_change["details"],
            )
        )
        next_log_id += 1
    if pure_change["changed"]:
        audit_logs.append(
            build_audit_log(
                next_log_id,
                MACAXEIRA_COMPANY_ID,
                "TECHNICAL_SHEET",
                PURE_GOIABA_MAC_SHEET_ID,
                "PURE GOIABA",
                "FIX_PURE_GOIABA_DUPLICATE_ROUTING",
                "Ficha duplicada Macaxeira de PURE GOIABA foi inativada e os usos ativos foram redirecionados para a ficha compartilhada do laboratorio.",
                pure_change["details"],
            )
        )
        next_log_id += 1

    report = {
        "apiBase": API_BASE,
        "checkedAt": now_iso(),
        "apply": args.apply,
        "backupDir": backup_dir,
        "xaropeChange": {
            "changed": xarope_change["changed"],
            "details": xarope_change["details"],
        },
        "pindoramaChange": {
            "changed": pindorama_change["changed"],
            "details": pindorama_change["details"],
        },
        "pureGoiabaChange": {
            "changed": pure_change["changed"],
            "details": pure_change["details"],
        },
        "auditLogIds": [log["id"] for log in audit_logs],
    }

    if args.apply:
        if xarope_change["changed"]:
            request_json("PUT", f"/technical-sheets/{XAROPE_CAJA_SHEET_ID}", xarope_change["sheetAfter"])
            request_json("PUT", f"/stock-centers/{LAB_CENTER_ID}", xarope_change["centerAfter"])
        if pindorama_change["changed"]:
            request_json("PUT", f"/technical-sheets/{PINDORAMA_MAC_SHEET_ID}", pindorama_change["sheetAfter"])
        for item in pure_change["changedIngredientSheets"]:
            request_json("PUT", f"/technical-sheets/{item['after']['id']}", item["after"])
        if pure_change["oldSheetAfter"] != pure_change["oldSheetBefore"]:
            request_json("PUT", f"/technical-sheets/{PURE_GOIABA_MAC_SHEET_ID}", pure_change["oldSheetAfter"])
        if pure_change["productAfter"] and pure_change["productAfter"] != pure_change["productBefore"]:
            encoded = urllib.parse.quote(pure_change["productAfter"]["id"], safe="")
            request_json("PUT", f"/products/{encoded}", pure_change["productAfter"])
        for item in pure_change["changedCenters"]:
            request_json(
                "PUT",
                f"/stock-centers/{item['after']['id']}",
                {**item["after"], "allowSalesImportMinimumPrune": True},
                headers={"x-allow-sales-import-minimum-prune": "true"},
            )
        for log in audit_logs:
            request_json("POST", "/audit-logs", log)

    os.makedirs("auditorias", exist_ok=True)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = f"auditorias/macaxeira-production-routing-cases-fix-{stamp}.json"
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Report: {path}", file=sys.stderr)


if __name__ == "__main__":
    main()

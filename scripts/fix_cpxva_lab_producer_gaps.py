#!/usr/bin/env python3
import argparse
import copy
import datetime as dt
import json
import math
import os
import sys
import urllib.error
import urllib.request


API_BASE = os.environ.get("GESTOR_API_BASE", "https://gestor-estoque-zqw9.onrender.com/api").rstrip("/")
LAB_CENTER_ID = 1
CPXVA_COMPANY_ID = 2
TARGET_SHEET_IDS = [115, 119]
TARGET_DEPENDENCIES = [
    {
        "dependencySheetId": 115,
        "parentSheetId": 116,
        "label": "TINTURA FRUTAS VERMELHAS via LICOR FRUTAS VERMELHAS LISBOA E NOSSA",
    },
    {
        "dependencySheetId": 119,
        "parentSheetId": 398,
        "label": "NECTAR ABACAXI via BATIDA PEQUI PRE-BATCHED",
    },
    {
        "dependencySheetId": 119,
        "parentSheetId": 120,
        "label": "NECTAR ABACAXI via INVASAO TROPICAL CLARIFICADO",
    },
]


def parse_decimal(value):
    if value is None:
        return None
    compact = str(value).replace(" ", "")
    normalized = compact
    if "," in compact and "." in compact:
        normalized = compact.replace(".", "").replace(",", ".")
    elif "," in compact:
        normalized = compact.replace(",", ".")
    elif __import__("re").match(r"^\d{1,3}(\.\d{3})+$", compact):
        normalized = compact.replace(".", "")
    try:
        parsed = float(normalized)
    except ValueError:
        return None
    return parsed if math.isfinite(parsed) else None


def format_decimal(value):
    rounded = round(value + 1e-9, 2)
    if abs(rounded - round(rounded)) < 1e-9:
        return f"{int(round(rounded)):,}".replace(",", ".")
    whole, frac = f"{rounded:,.2f}".split(".")
    return f"{whole.replace(',', '.')},{frac}"


def request_json(method, path, body=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: HTTP {exc.code}: {detail}") from exc


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def load_state():
    state = {
        "technicalSheets": [],
        "stockCenters": request_json("GET", "/stock-centers")["stockCenters"],
        "manualProductionRequests": request_json("GET", f"/manual-production-requests?companyId={CPXVA_COMPANY_ID}")[
            "manualProductionRequests"
        ],
        "auditLogs": request_json("GET", "/audit-logs")["auditLogs"],
        "inventoryCounts": request_json("GET", f"/inventory-counts?companyId={CPXVA_COMPANY_ID}")["inventoryCounts"],
    }
    sheet_ids = set(TARGET_SHEET_IDS)
    sheet_ids.update(item["parentSheetId"] for item in TARGET_DEPENDENCIES)
    for sheet_id in sorted(sheet_ids):
        state["technicalSheets"].append(request_json("GET", f"/technical-sheets/{sheet_id}")["technicalSheet"])
    return state


def save_backup(state):
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = f"backups/online-before-cpxva-lab-producer-gaps-{stamp}"
    os.makedirs(backup_dir, exist_ok=True)
    for key, value in state.items():
        with open(os.path.join(backup_dir, f"{key}.json"), "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
    return backup_dir


def max_int_id(records):
    ids = [int(record["id"]) for record in records if isinstance(record.get("id"), int)]
    return max(ids) if ids else 0


def build_audit_log(log_id, target_type, target_id, target_label, summary, details):
    occurred_at = now_iso()
    return {
        "id": log_id,
        "companyId": CPXVA_COMPANY_ID,
        "actorUserId": None,
        "actorUserName": "Igarape A&B Master",
        "actorUsername": "igarape.aeb",
        "actorRole": "MASTER",
        "actorKind": "SYSTEM_ADMIN",
        "module": "FICHAS",
        "actionKey": "FIX_LAB_PRODUCER_ASSIGNMENT",
        "actionLabel": "Correcao de centro produtor",
        "targetType": target_type,
        "targetId": str(target_id),
        "targetLabel": target_label,
        "summary": summary,
        "impactSummary": "Centro produtor e fila de entrada de producao foram ajustados conforme validacao operacional.",
        "severity": "HIGH",
        "result": "SUCCESS",
        "relatedCompanyIds": [5],
        "details": details,
        "occurredAt": occurred_at,
    }


def sheet_by_id(state):
    return {sheet["id"]: sheet for sheet in state["technicalSheets"]}


def find_lab(state):
    for center in state["stockCenters"]:
        if center.get("id") == LAB_CENTER_ID:
            return center
    raise RuntimeError("LABORATORIO center id=1 not found")


def ensure_lab_assignment(state):
    sheets = sheet_by_id(state)
    lab = copy.deepcopy(find_lab(state))
    changed_sheets = []
    produced_ids = list(lab.get("producedTechnicalSheetIds") or [])

    for sheet_id in TARGET_SHEET_IDS:
        sheet = copy.deepcopy(sheets[sheet_id])
        previous_centers = copy.deepcopy(sheet.get("productionCenters") or [])
        production_centers = list(previous_centers)
        if not any(int(item.get("stockCenterId") or 0) == LAB_CENTER_ID for item in production_centers):
            production_centers.append({"stockCenterId": LAB_CENTER_ID, "minimumQuantity": ""})
            sheet["productionCenters"] = production_centers
            changed_sheets.append(
                {
                    "before": sheets[sheet_id],
                    "after": sheet,
                    "previousProductionCenters": previous_centers,
                    "nextProductionCenters": production_centers,
                }
            )
        if sheet_id not in produced_ids:
            produced_ids.append(sheet_id)

    previous_produced_ids = copy.deepcopy(lab.get("producedTechnicalSheetIds") or [])
    lab["producedTechnicalSheetIds"] = sorted(set(produced_ids))
    center_changed = previous_produced_ids != lab["producedTechnicalSheetIds"]
    return changed_sheets, (find_lab(state), lab, previous_produced_ids) if center_changed else None


def count_available_in_lab(state, sheet_id):
    # The audit target had no count records. Keep this conservative and only
    # subtract records that explicitly belong to the lab and the technical sheet.
    total = 0.0
    matched = 0
    for record in state["inventoryCounts"]:
        if record.get("stockCenterId") != LAB_CENTER_ID:
            continue
        if record.get("kind") != "PREPARO" or record.get("technicalSheetId") != sheet_id:
            continue
        quantity = parse_decimal(record.get("totalCountedQuantity"))
        if quantity is None:
            continue
        total += quantity
        matched += 1
    return total, matched


def compute_dependency_entries(state):
    sheets = sheet_by_id(state)
    existing_keys = {
        (record.get("centerId"), record.get("sheetId"), record.get("parentRequestId"))
        for record in state["manualProductionRequests"]
        if record.get("companyId") == CPXVA_COMPANY_ID
    }
    existing_by_sheet = {
        record.get("sheetId")
        for record in state["manualProductionRequests"]
        if record.get("companyId") == CPXVA_COMPANY_ID and record.get("centerId") == LAB_CENTER_ID
    }
    next_id = max_int_id(state["manualProductionRequests"]) + 1
    entries = []
    details = []

    for dependency in TARGET_DEPENDENCIES:
        parent = sheets[dependency["parentSheetId"]]
        child = sheets[dependency["dependencySheetId"]]
        parent_request = next(
            (
                record
                for record in state["manualProductionRequests"]
                if record.get("companyId") == CPXVA_COMPANY_ID
                and record.get("centerId") == LAB_CENTER_ID
                and record.get("sheetId") == parent["id"]
                and record.get("sourceRequisitionId") == 136
            ),
            None,
        )
        if not parent_request:
            details.append({**dependency, "status": "SKIPPED_PARENT_REQUEST_NOT_FOUND"})
            continue

        ingredient = next(
            (
                item
                for item in parent.get("ingredients", [])
                if item.get("isActive") is not False and item.get("productId") == child.get("productId")
            ),
            None,
        )
        if not ingredient:
            details.append({**dependency, "status": "SKIPPED_INGREDIENT_NOT_FOUND"})
            continue

        if (LAB_CENTER_ID, child["id"], parent_request["id"]) in existing_keys:
            details.append({**dependency, "status": "SKIPPED_ALREADY_EXISTS", "parentRequestId": parent_request["id"]})
            continue

        desired_yield = parse_decimal(parent_request.get("desiredYield"))
        base_yield = parse_decimal(parent.get("outputQuantity"))
        ingredient_quantity = parse_decimal(ingredient.get("quantity"))
        if not desired_yield or not base_yield or not ingredient_quantity:
            details.append({**dependency, "status": "SKIPPED_INVALID_QUANTITY"})
            continue

        required = desired_yield * ingredient_quantity / base_yield
        available, count_records = count_available_in_lab(state, child["id"])
        already_requested = 0.0 if child["id"] not in existing_by_sheet else None
        if already_requested is None:
            details.append({**dependency, "status": "SKIPPED_SHEET_ALREADY_IN_QUEUE"})
            continue
        shortage = max(required - available, 0)
        if shortage <= 0:
            details.append({**dependency, "status": "SKIPPED_AVAILABLE_STOCK", "available": format_decimal(available)})
            continue

        entry = {
            "id": next_id,
            "companyId": CPXVA_COMPANY_ID,
            "centerId": LAB_CENTER_ID,
            "sheetId": child["id"],
            "desiredYield": format_decimal(shortage),
            "createdAt": now_iso(),
            "createdByUserId": None,
            "createdByUserName": "Administrador do sistema",
            "rootRequestId": parent_request["rootRequestId"],
            "parentRequestId": parent_request["id"],
            "isDependencyRequest": True,
            "planningSourceKind": "PREPARO",
            "planningSourceCenterId": LAB_CENTER_ID,
            "planningSourceCenterName": "LABORATORIO",
            "planningSourceSheetId": parent["id"],
            "planningSourceSheetName": parent["name"],
            "planningSourceQuantityLabel": parent_request.get("planningSourceQuantityLabel", ""),
            "sourceRequisitionId": parent_request.get("sourceRequisitionId"),
            "sourceRequisitionGroupId": parent_request.get("sourceRequisitionGroupId"),
            "sourceRequisitionLineKey": parent_request.get("sourceRequisitionLineKey", ""),
        }
        entries.append(entry)
        details.append(
            {
                **dependency,
                "status": "CREATE",
                "requestId": next_id,
                "parentRequestId": parent_request["id"],
                "requiredYield": format_decimal(required),
                "availableInLab": format_decimal(available),
                "labCountRecords": count_records,
                "shortageYield": entry["desiredYield"],
            }
        )
        next_id += 1

    return entries, details


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    state = load_state()
    backup_dir = save_backup(state)
    changed_sheets, center_change = ensure_lab_assignment(state)
    entries, dependency_details = compute_dependency_entries(state)
    next_log_id = max_int_id(state["auditLogs"]) + 1
    audit_logs = []

    if changed_sheets or center_change:
        details = {
            "sheetIds": TARGET_SHEET_IDS,
            "changedSheets": [
                {
                    "sheetId": item["after"]["id"],
                    "sheetName": item["after"]["name"],
                    "previousProductionCenters": item["previousProductionCenters"],
                    "nextProductionCenters": item["nextProductionCenters"],
                }
                for item in changed_sheets
            ],
            "stockCenterId": LAB_CENTER_ID,
            "previousProducedTechnicalSheetIds": center_change[2] if center_change else None,
            "nextProducedTechnicalSheetIds": center_change[1]["producedTechnicalSheetIds"] if center_change else None,
        }
        audit_logs.append(
            build_audit_log(
                next_log_id,
                "TECHNICAL_SHEET",
                "115,119",
                "TINTURA FRUTAS VERMELHAS; NECTAR ABACAXI",
                "LABORATORIO foi vinculado como centro produtor das fichas TINTURA FRUTAS VERMELHAS e NECTAR ABACAXI.",
                details,
            )
        )
        next_log_id += 1

    for entry in entries:
        child = sheet_by_id(state)[entry["sheetId"]]
        audit_logs.append(
            build_audit_log(
                next_log_id,
                "MANUAL_PRODUCTION_REQUEST",
                entry["id"],
                child["name"],
                f"Entrada complementar de producao criada para {child['name']} no LABORATORIO.",
                {"manualProductionRequest": entry},
            )
        )
        next_log_id += 1

    report = {
        "apiBase": API_BASE,
        "checkedAt": now_iso(),
        "apply": args.apply,
        "backupDir": backup_dir,
        "changedSheets": [
            {
                "sheetId": item["after"]["id"],
                "sheetName": item["after"]["name"],
                "previousProductionCenters": item["previousProductionCenters"],
                "nextProductionCenters": item["nextProductionCenters"],
            }
            for item in changed_sheets
        ],
        "centerChange": None
        if not center_change
        else {
            "stockCenterId": LAB_CENTER_ID,
            "previousProducedCount": len(center_change[2]),
            "nextProducedCount": len(center_change[1]["producedTechnicalSheetIds"]),
            "addedSheetIds": sorted(set(center_change[1]["producedTechnicalSheetIds"]) - set(center_change[2])),
        },
        "dependencyEntries": dependency_details,
        "createdManualProductionRequests": entries,
        "auditLogIds": [log["id"] for log in audit_logs],
    }

    if args.apply:
        for item in changed_sheets:
            request_json("PUT", f"/technical-sheets/{item['after']['id']}", item["after"])
        if center_change:
            request_json("PUT", f"/stock-centers/{LAB_CENTER_ID}", center_change[1])
        for entry in entries:
            request_json("POST", "/manual-production-requests", entry)
        for log in audit_logs:
            request_json("POST", "/audit-logs", log)

    os.makedirs("auditorias", exist_ok=True)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = f"auditorias/cpxva-lab-producer-gaps-fix-{stamp}.json"
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Report: {report_path}", file=sys.stderr)


if __name__ == "__main__":
    main()

CREATE SEQUENCE IF NOT EXISTS "AppUserRecord_id_seq";
ALTER SEQUENCE "AppUserRecord_id_seq" OWNED BY "AppUserRecord"."id";
ALTER TABLE "AppUserRecord" ALTER COLUMN "id" SET DEFAULT nextval('"AppUserRecord_id_seq"');

-- Reserve historical user identities too; deleting a user must not reuse their identity.
SELECT setval('"AppUserRecord_id_seq"', GREATEST(
  COALESCE((SELECT MAX("id") FROM "AppUserRecord"), 0),
  COALESCE((SELECT MAX("createdByUserId") FROM "AppInventoryCountRecord"), 0),
  COALESCE((SELECT MAX("startedByUserId") FROM "AppInventoryCountSessionRecord"), 0),
  COALESCE((SELECT MAX("actorUserId") FROM "AppAuditLogRecord"), 0),
  COALESCE((SELECT MAX(CASE WHEN "targetId" ~ '^[0-9]{1,9}$' THEN "targetId"::integer END)
    FROM "AppAuditLogRecord" WHERE "targetType" = 'USER'), 0)
) + 1, false);

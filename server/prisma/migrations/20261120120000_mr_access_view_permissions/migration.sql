-- Data only. Birthdays (occasions:view) and the holiday calendar (holidays:view) became
-- their own permissions so Admin can switch them off for MRs. Role defaults get them from
-- the bootstrap seed; users with a customized set (Managers) get them here, so nothing
-- they see today changes. Re-running inserts nothing new.
INSERT INTO "user_permissions" ("userId", "permission", "allowed", "createdAt", "updatedAt")
SELECT u."id", p."permission", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
CROSS JOIN (VALUES ('occasions:view'), ('holidays:view')) AS p("permission")
WHERE u."permissionsCustomized" = true
ON CONFLICT ("userId", "permission") DO NOTHING;

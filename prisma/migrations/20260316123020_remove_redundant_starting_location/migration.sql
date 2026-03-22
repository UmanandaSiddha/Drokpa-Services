-- Reuse the shared tour address before removing the redundant starting-location relation.
UPDATE "Tour"
SET "addressId" = COALESCE("addressId", "startingLocationAddressId")
WHERE "startingLocationAddressId" IS NOT NULL;

ALTER TABLE "Tour"
DROP CONSTRAINT IF EXISTS "tour_trek_required_fields_chk";

ALTER TABLE "Tour"
DROP CONSTRAINT IF EXISTS "Tour_startingLocationAddressId_fkey";

DROP INDEX IF EXISTS "Tour_startingLocationAddressId_idx";

ALTER TABLE "Tour"
DROP COLUMN IF EXISTS "startingLocationAddressId",
DROP COLUMN IF EXISTS "startingLocation";

ALTER TABLE "Tour"
ADD CONSTRAINT "tour_trek_required_fields_chk"
CHECK (
    "type" <> 'TREK'::"TourType"
    OR (
        NULLIF(BTRIM("maxAltitude"), '') IS NOT NULL
        AND NULLIF(BTRIM("distance"), '') IS NOT NULL
        AND NULLIF(BTRIM("bestSeason"), '') IS NOT NULL
    )
) NOT VALID;

UPDATE "Tour" t
SET
    "maxAltitude" = COALESCE(NULLIF(BTRIM(t."maxAltitude"), ''), 'Not specified'),
    "distance" = COALESCE(NULLIF(BTRIM(t."distance"), ''), 'Not specified'),
    "bestSeason" = COALESCE(NULLIF(BTRIM(t."bestSeason"), ''), 'Not specified')
WHERE t."type" = 'TREK'::"TourType"
    AND (
        NULLIF(BTRIM(t."maxAltitude"), '') IS NULL
        OR NULLIF(BTRIM(t."distance"), '') IS NULL
        OR NULLIF(BTRIM(t."bestSeason"), '') IS NULL
    );

ALTER TABLE "Tour"
VALIDATE CONSTRAINT "tour_trek_required_fields_chk";
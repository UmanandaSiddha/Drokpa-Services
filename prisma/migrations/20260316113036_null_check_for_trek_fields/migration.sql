ALTER TABLE "Tour"
DROP CONSTRAINT IF EXISTS "tour_trek_required_fields_chk";

ALTER TABLE "Tour"
ADD CONSTRAINT "tour_trek_required_fields_chk"
CHECK (
    "type" <> 'TREK'::"TourType"
    OR (
    NULLIF(BTRIM("maxAltitude"), '') IS NOT NULL
    AND NULLIF(BTRIM("distance"), '') IS NOT NULL
    AND NULLIF(BTRIM("bestSeason"), '') IS NOT NULL
    AND NULLIF(BTRIM("startingLocation"), '') IS NOT NULL
    )
) NOT VALID;

UPDATE "Tour" t
SET
    "maxAltitude" = COALESCE(NULLIF(BTRIM(t."maxAltitude"), ''), 'Not specified'),
    "distance" = COALESCE(NULLIF(BTRIM(t."distance"), ''), 'Not specified'),
    "bestSeason" = COALESCE(NULLIF(BTRIM(t."bestSeason"), ''), 'Not specified'),
    "startingLocation" = COALESCE(
        NULLIF(BTRIM(t."startingLocation"), ''),
        NULLIF(
            BTRIM(
                (
                    SELECT CONCAT_WS(', ', a."city", a."state")
                    FROM "Address" a
                    WHERE a."id" = t."addressId"
                )
            ),
            ''
        ),
        'Not specified'
    )
WHERE t."type" = 'TREK'::"TourType"
    AND (
        NULLIF(BTRIM(t."maxAltitude"), '') IS NULL
        OR NULLIF(BTRIM(t."distance"), '') IS NULL
        OR NULLIF(BTRIM(t."bestSeason"), '') IS NULL
        OR NULLIF(BTRIM(t."startingLocation"), '') IS NULL
    );

ALTER TABLE "Tour"
VALIDATE CONSTRAINT "tour_trek_required_fields_chk";
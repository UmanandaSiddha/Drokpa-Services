-- Enforce only one of tourId/homestayId is set on Review
ALTER TABLE "Review" ADD CONSTRAINT chk_review_one_target
    CHECK (
        ("tourId" IS NOT NULL AND "homestayId" IS NULL) OR
        ("tourId" IS NULL AND "homestayId" IS NOT NULL)
    );

-- Prevent a user from reviewing the same tour twice
CREATE UNIQUE INDEX uq_review_user_tour
    ON "Review" ("userId", "tourId")
    WHERE "tourId" IS NOT NULL;

-- Prevent a user from reviewing the same homestay twice
CREATE UNIQUE INDEX uq_review_user_homestay
    ON "Review" ("userId", "homestayId")
    WHERE "homestayId" IS NOT NULL;

-- Enforce only one of tourId/homestayId is set on BucketListItem
ALTER TABLE "BucketListItem" ADD CONSTRAINT chk_bucketlistitem_one_product
    CHECK (
        ("tourId" IS NOT NULL AND "homestayId" IS NULL) OR
        ("tourId" IS NULL AND "homestayId" IS NOT NULL)
    );
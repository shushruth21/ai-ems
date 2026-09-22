-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "require_mfa" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "accepted_by_id" UUID,
ADD COLUMN     "revoked_at" TIMESTAMP(3);

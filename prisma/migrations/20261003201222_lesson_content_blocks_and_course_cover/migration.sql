-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "coverImage" TEXT;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "content" JSONB;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'paid';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" DROP DEFAULT;

/*
  Warnings:

  - Added the required column `location` to the `Shift` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "location" TEXT NOT NULL DEFAULT 'TBD';

ALTER TABLE "Shift" ALTER COLUMN "location" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TimelineEvent" ADD COLUMN     "newState" TEXT,
ADD COLUMN     "oldState" TEXT;

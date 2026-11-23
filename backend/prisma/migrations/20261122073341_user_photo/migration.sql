-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "photoUpdatedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "UserPhoto" (
    "userId" UUID NOT NULL,
    "mime" VARCHAR(20) NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserPhoto_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserPhoto" ADD CONSTRAINT "UserPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

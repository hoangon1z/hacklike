CREATE TABLE "Announcement" (
 "id" TEXT PRIMARY KEY, "authorId" TEXT NOT NULL REFERENCES "User"("id"),
 "title" TEXT NOT NULL, "content" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'NEWS',
 "published" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Announcement_published_createdAt_idx" ON "Announcement"("published", "createdAt");
CREATE TABLE "NotificationRead" (
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "eventId" TEXT NOT NULL, "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId", "eventId")
);

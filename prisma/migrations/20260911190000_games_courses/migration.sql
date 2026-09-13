-- B2.0: juegos y ruta de aprendizaje. Todo nuevo (cero riesgo en datos existentes).
CREATE TYPE "LessonType" AS ENUM ('READ', 'QUIZ', 'COMPLETE');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "UserGameSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "game" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 1,
    "won" INTEGER NOT NULL DEFAULT 0,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGameSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserGameSession_userId_game_idx" ON "UserGameSession"("userId", "game");
CREATE INDEX "UserGameSession_sessionKey_game_idx" ON "UserGameSession"("sessionKey", "game");

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sequential" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Module_courseId_order_idx" ON "Module"("courseId", "order");

CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LessonType" NOT NULL DEFAULT 'READ',
    "order" INTEGER NOT NULL DEFAULT 0,
    "wordId" TEXT,
    "payload" TEXT,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Lesson_moduleId_order_idx" ON "Lesson"("moduleId", "order");

CREATE TABLE "UserLessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserLessonProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserLessonProgress_userId_lessonId_key" ON "UserLessonProgress"("userId", "lessonId");
CREATE INDEX "UserLessonProgress_userId_idx" ON "UserLessonProgress"("userId");

ALTER TABLE "UserGameSession" ADD CONSTRAINT "UserGameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "DictionaryWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserLessonProgress" ADD CONSTRAINT "UserLessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserLessonProgress" ADD CONSTRAINT "UserLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

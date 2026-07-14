-- CreateTable
CREATE TABLE "DepartmentPerformance" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "ticketsAssignedTotal" INTEGER NOT NULL DEFAULT 0,
    "assignedCriticalCount" INTEGER NOT NULL DEFAULT 0,
    "assignedHighCount" INTEGER NOT NULL DEFAULT 0,
    "assignedMediumCount" INTEGER NOT NULL DEFAULT 0,
    "assignedLowCount" INTEGER NOT NULL DEFAULT 0,
    "ticketsResolvedTotal" INTEGER NOT NULL DEFAULT 0,
    "resolvedCriticalCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedHighCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedMediumCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedLowCount" INTEGER NOT NULL DEFAULT 0,
    "closedInTimeTotal" INTEGER NOT NULL DEFAULT 0,
    "inTimeCriticalCount" INTEGER NOT NULL DEFAULT 0,
    "inTimeHighCount" INTEGER NOT NULL DEFAULT 0,
    "inTimeMediumCount" INTEGER NOT NULL DEFAULT 0,
    "inTimeLowCount" INTEGER NOT NULL DEFAULT 0,
    "closedAfterDeadlineTotal" INTEGER NOT NULL DEFAULT 0,
    "afterDeadlineCriticalCount" INTEGER NOT NULL DEFAULT 0,
    "afterDeadlineHighCount" INTEGER NOT NULL DEFAULT 0,
    "afterDeadlineMediumCount" INTEGER NOT NULL DEFAULT 0,
    "afterDeadlineLowCount" INTEGER NOT NULL DEFAULT 0,
    "currentWorkingTotal" INTEGER NOT NULL DEFAULT 0,
    "currentWorkingBreachedTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentPerformance_departmentId_idx" ON "DepartmentPerformance"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentPerformance_departmentId_period_key" ON "DepartmentPerformance"("departmentId", "period");

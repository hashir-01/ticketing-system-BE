-- CreateTable
CREATE TABLE "EmployeePerformance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "ticketsAssignedTotal" INTEGER NOT NULL DEFAULT 0,
    "assignedCriticalCount" INTEGER NOT NULL DEFAULT 0,
    "assignedHighCount" INTEGER NOT NULL DEFAULT 0,
    "assignedMediumCount" INTEGER NOT NULL DEFAULT 0,
    "assignedLowCount" INTEGER NOT NULL DEFAULT 0,
    "ticketsClosedTotal" INTEGER NOT NULL DEFAULT 0,
    "closedInTimeTotal" INTEGER NOT NULL DEFAULT 0,
    "closedAfterDeadline" INTEGER NOT NULL DEFAULT 0,
    "activeWorkloadTotal" INTEGER NOT NULL DEFAULT 0,
    "activeWorkloadBreached" INTEGER NOT NULL DEFAULT 0,
    "inTimeCriticalCount" INTEGER NOT NULL DEFAULT 0,
    "inTimeHighCount" INTEGER NOT NULL DEFAULT 0,
    "inTimeMediumCount" INTEGER NOT NULL DEFAULT 0,
    "inTimeLowCount" INTEGER NOT NULL DEFAULT 0,
    "afterDeadlineCriticalCount" INTEGER NOT NULL DEFAULT 0,
    "afterDeadlineHighCount" INTEGER NOT NULL DEFAULT 0,
    "afterDeadlineMediumCount" INTEGER NOT NULL DEFAULT 0,
    "afterDeadlineLowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeePerformance_employeeId_idx" ON "EmployeePerformance"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePerformance_employeeId_period_key" ON "EmployeePerformance"("employeeId", "period");

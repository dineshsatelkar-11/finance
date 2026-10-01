import {
  daysInMonth,
  inr,
  monthLabel,
  openWhatsApp,
  prevMonthISO,
  salarySettlement,
  suggestedSalary,
} from "./format";
import type { Driver, Fleet, Payout } from "./types";

export type SalarySlipData = {
  company: string;
  driverName: string;
  mobile: string;
  month: string;
  monthLabel: string;
  date: string;
  /** Calendar days in salary month */
  daysInMonth: number;
  /** Full-month salary before leave (base or daily×days) */
  baseSalary: number;
  leaveDays: number;
  presentDays: number;
  /** Amount reduced due to leave (base − gross) */
  leaveAmount: number;
  /** Gross after leave */
  gross: number;
  bonus: number;
  /** Full monthly tempo rent (before off-days waiver) */
  rentFull: number;
  /** Days rent was waived (breakdown / off) */
  rentOffDays: number;
  /** Days rent is charged for */
  rentDays: number;
  /** Rent amount charged */
  rent: number;
  rentFleetName: string | null;
  deduction: number;
  /** Running balance before this slip (negative = advance already taken) */
  balanceBefore: number;
  slipAmount: number;
  balanceAfter: number;
  note?: string;
};

const COMPANY = "Satelkars Logistic";

function fullMonthSalary(
  driver: { kind: string; baseSalary: number; dailyRate: number },
  month: string,
): number {
  return suggestedSalary(driver, 0, month);
}

export function buildSalarySlipData(input: {
  driver: Driver;
  month: string;
  date: string;
  leaveDays: number;
  payouts: Payout[];
  fleets: Fleet[];
  bonus?: number;
  deduction?: number;
  rentOffDays?: number;
  slipAmountOverride?: number;
  /** When reopening an existing salary payout, exclude it so balanceBefore is correct */
  excludePayoutId?: string;
}): SalarySlipData {
  // Balance "before this slip" = running balance excluding this salary payout (if any)
  const payoutsForBefore = input.excludePayoutId
    ? input.payouts.filter((p) => p.id !== input.excludePayoutId)
    : input.payouts;

  const settle = salarySettlement({
    driver: input.driver,
    leaveDays: input.leaveDays,
    month: input.month,
    payouts: payoutsForBefore,
    fleets: input.fleets,
    bonus: input.bonus || 0,
    deduction: input.deduction || 0,
    rentOffDays: input.rentOffDays || 0,
  });
  const dim = daysInMonth(input.month);
  const leave = Math.max(0, Math.min(dim, Math.floor(input.leaveDays) || 0));
  const present = Math.max(0, dim - leave);
  const baseSalary = fullMonthSalary(input.driver, input.month);
  const leaveAmount = Math.max(0, Math.round((baseSalary - settle.gross) * 100) / 100);

  const rentFull = settle.rentFull || 0;
  const rentOff = settle.rentOffDays || 0;
  const rentDays = rentFull > 0 ? Math.max(0, dim - rentOff) : 0;

  const slip =
    input.slipAmountOverride != null && input.slipAmountOverride > 0
      ? input.slipAmountOverride
      : Math.round((settle.gross + settle.bonus - settle.rent - settle.deduction) * 100) / 100;

  // settle.balance is BEFORE this slip (we excluded it when reopening)
  const balanceBefore = Math.round(settle.balance * 100) / 100;
  const balanceAfter = Math.round((balanceBefore + slip) * 100) / 100;

  return {
    company: COMPANY,
    driverName: input.driver.name,
    mobile: input.driver.mobile || "",
    month: input.month,
    monthLabel: monthLabel(input.month),
    date: input.date,
    daysInMonth: dim,
    baseSalary,
    leaveDays: leave,
    presentDays: present,
    leaveAmount,
    gross: settle.gross,
    bonus: settle.bonus,
    rentFull,
    rentOffDays: rentOff,
    rentDays,
    rent: settle.rent,
    rentFleetName: settle.rentFleetName,
    deduction: settle.deduction,
    balanceBefore,
    slipAmount: slip,
    balanceAfter,
  };
}

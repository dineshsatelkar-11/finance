import { useFinance } from "./store";
import { loadFinanceFromDb, saveFinanceToDb, clearFinanceDb } from "./db-api";
import type {
  BankAccount,
  BankTransfer,
  Driver,
  Expense,
  FinanceSnapshot,
  Fleet,
  Loan,
  Payout,
} from "./types";

const WSB_LOAN_015: Loan = {
  id: "loan_wsb_000015",
  name: "WSB Mini — A/c …000015",
  bank: "Warana Sahakari Bank (HDFC0CSWSBL)",
  accountNo: "3970254350000015",
  ifsc: "HDFC0CSWSBL",
  principal: 398000,
  emiAmount: 8359,
  emiDay: 9,
  totalEmis: 60,
  startDate: "2026-09-09",
  endDate: "2031-09-09",
  interestRate: 9.5,
  outstanding: 398000,
  pendingEmis: 59,
  status: "active",
  fleetId: "fleet_wego_mh12zp2301",
  note: "SATELKARS LOGISTIC · Customer ID 554827 · Disburse 09/09/2026 · 398000 · EMI starts 09/10/2026 · 9.50% · Bajaj Wego MH-12-ZP-2301",
};

const WSB_CC_BANK: BankAccount = {
  id: "bank_wsb_cc_000001",
  name: "Warana CC · …000001",
  isDefault: false,
  opening: 0,
};

const WSB_CURRENT_BANK: BankAccount = {
  id: "bank_wsb_current_0498",
  name: "Warana Current · …0498",
  isDefault: false,
  opening: 11390,
};

const FLEET_WEGO: Fleet = {
  id: "fleet_wego_mh12zp2301",
  name: "Bajaj Wego",
  regNo: "MH-12-ZP-2301",
  kind: "tempo",
  monthlyRent: 0,
  active: true,
  loanId: "loan_wsb_000015",
  note: "New vehicle · loan …000015 · statement MH12ZP2301",
};

const STMT_DRIVERS: { id: string; name: string }[] = [
  { id: "drv_anand", name: "Anand" },
  { id: "drv_vikas", name: "Vikas" },
  { id: "drv_sandeep", name: "Sandeep" },
  { id: "drv_vivek", name: "Vivek" },
  { id: "drv_ballu", name: "Ballu" },
  { id: "drv_karan", name: "Karan" },
  { id: "drv_devraj", name: "Devraj" },
];

function ensureDriverByName(name: string, preferredId: string): string {
  const s = useFinance.getState();
  const existing = s.drivers.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const row: Driver = {
    id: preferredId,
    name,
    mobile: "",
    kind: "full",
    baseSalary: 0,
    dailyRate: 0,
    openingBalance: 0,
    active: true,
    upiVpa: "",
    upiPayeeName: name,
    upiUpdatedAt: null,
    fleetId: null,
    note: "From Warana statement import",
  };
  s.upsertDriver(row);
  return preferredId;
}

function resolveCurrentBankId(): string {
  const s = useFinance.getState();
  const found =
    s.banks.find(
      (b) =>
        b.id === WSB_CURRENT_BANK.id ||
        (/warana|warna/i.test(b.name) && /current|0498/i.test(b.name)),
    )?.id ||
    s.banks.find((b) => /warana|warna/i.test(b.name) && !/cc/i.test(b.name))?.id;
  if (found) return found;
  s.upsertBank(WSB_CURRENT_BANK);
  return WSB_CURRENT_BANK.id;
}

function resolveBajajBankId(): string {
  const s = useFinance.getState();
  const found = s.banks.find((b) => /bajaj/i.test(b.name))?.id;
  if (found) return found;
  const id = "bank_bajaj_auto";
  s.upsertBank({ id, name: "Bajaj", isDefault: false, opening: 0 });
  return id;
}

function resolveCcBankId(): string {
  const s = useFinance.getState();
  const found =
    s.banks.find((b) => b.id === WSB_CC_BANK.id)?.id ||
    s.banks.find((b) => /warana|warna/i.test(b.name) && /cc|cash.?credit|000001/i.test(b.name))?.id;
  if (found) return found;
  s.upsertBank(WSB_CC_BANK);
  return WSB_CC_BANK.id;
}

const STMT_DELETED_KEY = "finance_wsb_stmt_deleted_v1";

function readDeletedSeedIds(): Set<string> {
  try {
    if (typeof localStorage === "undefined") return new Set();
    const raw = localStorage.getItem(STMT_DELETED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function rememberDeletedSeedId(id: string) {
  if (!id) return;
  if (
    !id.startsWith("po_stmt_") &&
    !id.startsWith("exp_stmt_") &&
    !id.startsWith("xfer_") &&
    !id.startsWith("lp_stmt_") &&
    id !== "exp_cc_gst_20260825"
  ) {
    return;
  }
  try {
    if (typeof localStorage === "undefined") return;
    const set = readDeletedSeedIds();
    set.add(id);
    localStorage.setItem(STMT_DELETED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function ensureWsbLoan015AndCc(): boolean {
  const s0 = useFinance.getState();
  let changed = false;
  if (!s0.fleets.some((f) => f.id === FLEET_WEGO.id || /MH-?12-?ZP-?2301/i.test(f.regNo || ""))) {
    s0.upsertFleet(FLEET_WEGO);
    changed = true;
  }
  if (!s0.loans.some((l) => l.id === WSB_LOAN_015.id)) {
    s0.upsertLoan(WSB_LOAN_015);
    changed = true;
  } else {
    const loan015 = useFinance.getState().loans.find((l) => l.id === WSB_LOAN_015.id);
    if (loan015 && loan015.fleetId !== FLEET_WEGO.id) {
      useFinance.getState().upsertLoan({ ...loan015, fleetId: FLEET_WEGO.id });
      changed = true;
    }
  }
  if (!s0.banks.some((b) => b.id === WSB_CC_BANK.id)) {
    s0.upsertBank(WSB_CC_BANK);
    changed = true;
  }
  const currentId = resolveCurrentBankId();
  const cur = useFinance.getState().banks.find((b) => b.id === currentId);
  if (cur && Math.abs((cur.opening ?? 0) - 11390) > 0.001) {
    useFinance.getState().upsertBank({ ...cur, opening: 11390 });
    changed = true;
  }
  const driverIds: Record<string, string> = {};
  for (const d of STMT_DRIVERS) {
    driverIds[d.name] = ensureDriverByName(d.name, d.id);
  }
  const ccId = resolveCcBankId();
  const deletedIds = readDeletedSeedIds();
  const bajajId = resolveBajajBankId();
  const xfers: BankTransfer[] = [
    { id: "xfer_cc_to_cur_100_20260910", fromBankId: ccId, toBankId: currentId, amount: 100, date: "2026-09-10", note: "OWN CC → Current · statement", createdAt: "2026-09-10T12:00:00.000Z" },
    { id: "xfer_cc_to_cur_10k_a_20260911", fromBankId: ccId, toBankId: currentId, amount: 10000, date: "2026-09-11", note: "OWN CC → Current SELF · statement", createdAt: "2026-09-11T12:00:00.000Z" },
    { id: "xfer_cc_to_cur_10k_b_20260911", fromBankId: ccId, toBankId: currentId, amount: 10000, date: "2026-09-11", note: "OWN CC → Current · statement", createdAt: "2026-09-11T12:30:00.000Z" },
    { id: "xfer_own_to_cur_10k_20260916", fromBankId: ccId, toBankId: currentId, amount: 10000, date: "2026-09-16", note: "OWN ADVANCE → Current · statement", createdAt: "2026-09-16T12:00:00.000Z" },
    { id: "xfer_own_to_cur_31k_20260916", fromBankId: ccId, toBankId: currentId, amount: 31000, date: "2026-09-16", note: "OWN MACRO BODY → Current · statement", createdAt: "2026-09-16T12:30:00.000Z" },
    { id: "xfer_own_to_cur_25k_20260918", fromBankId: ccId, toBankId: currentId, amount: 25000, date: "2026-09-18", note: "OWN → Current · statement", createdAt: "2026-09-18T12:00:00.000Z" },
    { id: "xfer_own_to_cur_2k_20260918", fromBankId: ccId, toBankId: currentId, amount: 2000, date: "2026-09-18", note: "OWN → Current · statement", createdAt: "2026-09-18T12:30:00.000Z" },
    { id: "xfer_bajaj_to_warana_5000_20260901", fromBankId: bajajId, toBankId: currentId, amount: 5000, date: "2026-09-01", note: "Bajaj → Warana · 01-Sep", createdAt: "2026-09-01T12:00:00.000Z" },
    { id: "xfer_bajaj_to_warana_5000_20260904", fromBankId: bajajId, toBankId: currentId, amount: 5000, date: "2026-09-04", note: "Bajaj → Warana · 04-Sep", createdAt: "2026-09-04T12:00:00.000Z" },
    { id: "xfer_bajaj_to_warana_20000_20260909", fromBankId: bajajId, toBankId: currentId, amount: 20000, date: "2026-09-09", note: "Bajaj → Warana · 09-Sep", createdAt: "2026-09-09T12:00:00.000Z" },
    { id: "xfer_bajaj_to_warana_2000_20260910", fromBankId: bajajId, toBankId: currentId, amount: 2000, date: "2026-09-10", note: "Bajaj → Warana · 10-Sep", createdAt: "2026-09-10T12:00:00.000Z" },
    { id: "xfer_cc_to_cur_5k_20260921", fromBankId: ccId, toBankId: currentId, amount: 5000, date: "2026-09-21", note: "OWN CC → Current · statement", createdAt: "2026-09-21T12:00:00.000Z" },
  ];
  const seedById = new Map(xfers.map((x) => [x.id, x]));
  const existing = useFinance.getState().bankTransfers ?? [];
  let xferChanged = false;
  const nextX: BankTransfer[] = [];
  const seen = new Set<string>();
  for (const x of existing) {
    const seed = seedById.get(x.id);
    if (seed && !deletedIds.has(x.id)) {
      nextX.push(x.fromBankId !== seed.fromBankId || x.toBankId !== seed.toBankId ? { ...seed } : x);
      if (x.fromBankId !== seed.fromBankId || x.toBankId !== seed.toBankId) xferChanged = true;
      seen.add(x.id);
    } else {
      nextX.push(x);
      seen.add(x.id);
    }
  }
  for (const x of xfers) {
    if (deletedIds.has(x.id) || seen.has(x.id)) continue;
    nextX.push(x);
    xferChanged = true;
  }
  if (xferChanged) {
    useFinance.setState({ bankTransfers: nextX });
    changed = true;
  }
  type PSeed = Omit<Payout, "createdAt"> & { createdAt?: string };
  type ESeed = Omit<Expense, "createdAt"> & { createdAt?: string };
  const po = (id: string, driver: string, kind: Payout["kind"], amount: number, date: string, note: string): PSeed => ({
    id, driverId: driverIds[driver], kind, amount, date, mode: "upi", status: "paid", bankAccountId: currentId, upiVpa: "", note, createdAt: `${date}T12:00:00.000Z`,
  });
  const ex = (id: string, category: string, vendor: string, amount: number, date: string, note: string): ESeed => ({
    id, category, vendor, amount, date, mode: "upi", status: "paid", bankAccountId: currentId, upiVpa: "", fleetId: null, note, createdAt: `${date}T12:00:00.000Z`,
  });
  const payouts: PSeed[] = [
    po("po_stmt_20260827_vikas_er_250", "Vikas", "extra_route", 250, "2026-08-27", "UPI Vikas · statement"),
    po("po_stmt_20260827_vivek_er_250", "Vivek", "extra_route", 250, "2026-08-27", "UPI Vivek · statement"),
    po("po_stmt_20260827_anand_ret_300", "Anand", "return", 300, "2026-08-27", "UPI Mohan/Anand return · statement"),
    po("po_stmt_20260827_vikas_adv_1500", "Vikas", "advance", 1500, "2026-08-27", "UPI Vikas advance · statement"),
    po("po_stmt_20260828_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-08-28", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260828_vivek_er_250", "Vivek", "extra_route", 250, "2026-08-28", "UPI Vivek · statement"),
    po("po_stmt_20260829_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-08-29", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260829_vikas_adv_2000", "Vikas", "advance", 2000, "2026-08-29", "UPI Dnyaneshwar/Vikas advance · statement"),
    po("po_stmt_20260829_vikas_adv_1500", "Vikas", "advance", 1500, "2026-08-29", "UPI Dnyaneshwar/Vikas advance · statement"),
    po("po_stmt_20260830_ballu_adv_2000", "Ballu", "advance", 2000, "2026-08-30", "AVI Servicing → Ballu advance · statement"),
    po("po_stmt_20260831_vivek_er_250", "Vivek", "extra_route", 250, "2026-08-31", "UPI Vivek · statement"),
    po("po_stmt_20260831_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-08-31", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260831_vikas_er_250", "Vikas", "extra_route", 250, "2026-08-31", "UPI Vikas · statement"),
    po("po_stmt_20260901_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-01", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260901_sandeep_adv_1000", "Sandeep", "advance", 1000, "2026-09-01", "UPI Balaji/Sandeep advance · statement"),
    po("po_stmt_20260901_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-01", "UPI Vikas · statement"),
    po("po_stmt_20260902_ballu_er_500", "Ballu", "extra_route", 500, "2026-09-02", "AVI → Ballu extra route · statement"),
    po("po_stmt_20260902_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-02", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260902_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-02", "UPI Vikas · statement"),
    po("po_stmt_20260903_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-03", "UPI Vikas · statement"),
    po("po_stmt_20260903_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-03", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260903_ballu_er_500", "Ballu", "extra_route", 500, "2026-09-03", "AVI → Ballu extra route · statement"),
    po("po_stmt_20260904_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-04", "UPI Vikas · statement"),
    po("po_stmt_20260904_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-04", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260904_ballu_er_700", "Ballu", "extra_route", 700, "2026-09-04", "AVI → Ballu extra route · statement"),
    po("po_stmt_20260905_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-05", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260905_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-05", "UPI Vikas · statement"),
    po("po_stmt_20260905_karan_adv_2000", "Karan", "advance", 2000, "2026-09-05", "Vaishali/AVI → Karan advance · statement"),
    po("po_stmt_20260905_karan_adv_1000", "Karan", "advance", 1000, "2026-09-05", "Vaishali/AVI → Karan advance · statement"),
    po("po_stmt_20260905_vikas_ret_4000", "Vikas", "return", 4000, "2026-09-05", "Deepa → Vikas return · statement"),
    po("po_stmt_20260906_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-06", "UPI Vikas · statement"),
    po("po_stmt_20260906_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-06", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260906_sandeep_adv_500", "Sandeep", "advance", 500, "2026-09-06", "Sandeep advance · statement"),
    po("po_stmt_20260907_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-07", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260907_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-07", "UPI Vikas · statement"),
    po("po_stmt_20260908_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-08", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260908_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-08", "UPI Vikas · statement"),
    po("po_stmt_20260908_vivek_adv_300", "Vivek", "advance", 300, "2026-09-08", "Vivek advance · statement"),
    po("po_stmt_20260909_karan_adv_1968", "Karan", "advance", 1968, "2026-09-09", "Karan advance · statement"),
    po("po_stmt_20260909_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-09", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260909_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-09", "UPI Vikas · statement"),
    po("po_stmt_20260910_koli_er_1000", "Devraj", "extra_route", 1000, "2026-09-10", "Koli/Devraj extra route · statement"),
    po("po_stmt_20260910_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-10", "UPI Vikas · statement"),
    po("po_stmt_20260911_vivek_adv_10000", "Vivek", "advance", 10000, "2026-09-11", "Vivek advance · statement"),
    po("po_stmt_20260911_anand_adv_1102", "Anand", "advance", 1102, "2026-09-11", "Airtel recharge · Anand advance · statement"),
    po("po_stmt_20260911_koli_er_500", "Devraj", "extra_route", 500, "2026-09-11", "Koli/Devraj extra route · statement"),
    po("po_stmt_20260911_vivek_er_250", "Vivek", "extra_route", 250, "2026-09-11", "UPI Vivek · statement"),
    po("po_stmt_20260911_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-11", "UPI Vikas · statement"),
    po("po_stmt_20260912_vikas_ret_4000", "Vikas", "return", 4000, "2026-09-12", "Vikas return · statement"),
    po("po_stmt_20260912_vivek_er_250", "Vivek", "extra_route", 250, "2026-09-12", "UPI Master Vivek extra route · statement"),
    po("po_stmt_20260912_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-12", "UPI Maruti Biradar/Vikas extra route · statement"),
    po("po_stmt_20260912_ballu_er_1250", "Ballu", "extra_route", 1250, "2026-09-12", "AVI Servicing Ballu extra route · statement"),
    po("po_stmt_20260915_vivek_er_250_a", "Vivek", "extra_route", 250, "2026-09-15", "UPI Master Vivek extra route · statement"),
    po("po_stmt_20260915_vivek_er_250_b", "Vivek", "extra_route", 250, "2026-09-15", "UPI Master Vivek extra route · statement"),
    po("po_stmt_20260915_vikas_er_250_a", "Vikas", "extra_route", 250, "2026-09-15", "UPI Vikas extra route · statement"),
    po("po_stmt_20260915_vikas_er_250_b", "Vikas", "extra_route", 250, "2026-09-15", "UPI Vikas extra route · statement"),
    po("po_stmt_20260916_vikas_adv_9000", "Vikas", "advance", 9000, "2026-09-16", "Deepa Vikas advance · statement"),
    po("po_stmt_20260917_devraj_er_1500", "Devraj", "extra_route", 1500, "2026-09-17", "KOLI Devraj extra route · statement"),
    po("po_stmt_20260918_vivek_adv_300", "Vivek", "advance", 300, "2026-09-18", "Mane Rajkiran Vivek advance · statement"),
    po("po_stmt_20260919_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-19", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260919_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-19", "UPI Vikas · statement"),
    po("po_stmt_20260919_devraj_er_500_a", "Devraj", "extra_route", 500, "2026-09-19", "Koli/Devraj extra route · statement"),
    po("po_stmt_20260919_devraj_er_500_b", "Devraj", "extra_route", 500, "2026-09-19", "Koli/Devraj extra route · statement"),
    po("po_stmt_20260920_devraj_er_500", "Devraj", "extra_route", 500, "2026-09-20", "Koli/Devraj extra route · statement"),
    po("po_stmt_20260921_karan_adv_1000", "Karan", "advance", 1000, "2026-09-21", "Vaishali → Karan advance · statement"),
    po("po_stmt_20260921_devraj_er_500", "Devraj", "extra_route", 500, "2026-09-21", "Koli/Devraj extra route · statement"),
    po("po_stmt_20260922_ballu_er_500", "Ballu", "extra_route", 500, "2026-09-22", "AVI → Ballu extra route · statement"),
    po("po_stmt_20260922_sandeep_er_250", "Sandeep", "extra_route", 250, "2026-09-22", "UPI Balaji/Sandeep · statement"),
    po("po_stmt_20260922_vikas_er_250", "Vikas", "extra_route", 250, "2026-09-22", "UPI Vikas · statement"),
  ];
  const expenses: ESeed[] = [
    ex("exp_stmt_20260827_fleet8026_138", "Maintenance", "Fleet 8026", 138, "2026-08-27", "UPI Vivek · expense fleet 8026 · statement"),
    ex("exp_stmt_20260830_porter_200", "Porter", "Porter", 200, "2026-08-30", "Porter smartshift · statement"),
    ex("exp_stmt_20260903_cibil_siddhesh_199", "Other", "CIBIL · Siddhesh", 199.42, "2026-09-03", "CIBIL · statement"),
    ex("exp_stmt_20260903_cibil_dinesh_199", "Other", "CIBIL · Dinesh", 199.42, "2026-09-03", "CIBIL · statement"),
    ex("exp_stmt_20260904_porter_300", "Porter", "Porter", 300, "2026-09-04", "Porter · statement"),
    ex("exp_stmt_20260904_cab_250", "Other", "Cab book", 250, "2026-09-04", "Cab book · statement"),
    ex("exp_stmt_20260904_tempo_300", "Other", "Tempo collect", 300, "2026-09-04", "Tempo collect · statement"),
    ex("exp_stmt_20260904_ballu_food_100", "Other", "Ballu food", 100, "2026-09-04", "Ballu food · statement"),
    ex("exp_stmt_20260906_porter_200", "Porter", "Porter", 200, "2026-09-06", "Porter · statement"),
    ex("exp_stmt_20260907_stamp_2000", "Other", "Stamp in stock", 2000, "2026-09-07", "Loan stamp · statement"),
    ex("exp_stmt_20260909_project_report_2002", "Other", "Project report fee", 2002.96, "2026-09-09", "Project report · statement"),
    ex("exp_stmt_20260909_bclass_300", "Other", "B Class fee", 300, "2026-09-09", "B CLASS FEE · statement"),
    ex("exp_stmt_20260909_excess_share_10000", "Other", "Excess share", 10000, "2026-09-09", "EXCESS SHARE · statement"),
    ex("exp_stmt_20260909_process_fee_1298", "Other", "Process fee", 1298, "2026-09-09", "PROCESS FEE · statement"),
    ex("exp_stmt_20260909_cibil_2537", "Other", "CIBIL", 2537, "2026-09-09", "CIBIL · statement"),
    ex("exp_stmt_20260909_laxmi_motors_398029", "Other", "Laxmi Motors", 398029.5, "2026-09-09", "RTGS Laxmi Motors · statement"),
    ex("exp_stmt_20260910_vivek_tempo_drop_500", "Other", "Vivek · new tempo drop", 500, "2026-09-10", "New tempo drop · statement"),
    ex("exp_stmt_20260910_tempo8026_200", "Other", "Tempo drop 8026", 200, "2026-09-10", "Tempo drop · statement"),
    ex("exp_stmt_20260910_ballu_tempo8026_100", "Other", "Ballu · tempo drop 8026", 100, "2026-09-10", "Ballu tempo drop · statement"),
    ex("exp_stmt_20260911_tempo8646_9050", "Other", "Tempo 8646", 9050, "2026-09-11", "Tempo 8646 · statement"),
    ex("exp_stmt_20260912_tempo_booking_800", "Other", "Tempo booking", 800, "2026-09-12", "Tempo booking · statement"),
    ex("exp_stmt_20260917_tempo_pickup_200", "Other", "Tempo pickup & drop", 200, "2026-09-17", "MH12ZP2301 · statement"),
    ex("exp_stmt_20260917_tempo_pickup_100", "Other", "Tempo pickup & drop", 100, "2026-09-17", "MH12ZP2301 · statement"),
    ex("exp_stmt_20260917_tempo_pickup_300", "Other", "Tempo pickup & drop", 300, "2026-09-17", "MH12ZP2301 · statement"),
    ex("exp_stmt_20260918_tempo_pickup_300", "Other", "Tempo pickup & drop", 300, "2026-09-18", "MH12ZP2301 · statement"),
    ex("exp_stmt_20260918_prakash_1", "Other", "Prakash", 1, "2026-09-18", "Prakash tempo body · statement"),
    ex("exp_stmt_20260918_prakash_varma_20000", "Other", "Prakash Varma", 20000, "2026-09-18", "Prakash tempo body · statement"),
    ex("exp_stmt_20260918_prakash_varma_10499", "Other", "Prakash Varma", 10499, "2026-09-18", "Prakash tempo body · statement"),
    ex("exp_stmt_20260918_mane_number_plate_500", "Other", "Mane Rajkiran", 500, "2026-09-18", "Number plate · statement"),
    ex("exp_stmt_20260921_porter_115", "Porter", "Porter", 115, "2026-09-21", "Porter · statement"),
  ];
  const existingPo = new Set(useFinance.getState().payouts.map((p) => p.id));
  const missingPo = payouts.filter((p) => !existingPo.has(p.id) && !deletedIds.has(p.id));
  if (missingPo.length) {
    useFinance.setState((state) => ({ payouts: [...(missingPo as Payout[]), ...state.payouts] }));
    changed = true;
  }
  const existingEx = new Set(useFinance.getState().expenses.map((e) => e.id));
  const missingEx = expenses.filter((e) => !existingEx.has(e.id) && !deletedIds.has(e.id));
  if (missingEx.length) {
    useFinance.setState((state) => ({ expenses: [...(missingEx as Expense[]), ...state.expenses] }));
    changed = true;
  }
  return changed;
}

export const EMPTY_FINANCE_SNAPSHOT: FinanceSnapshot = {
  drivers: [], fleets: [], loans: [], loanPayments: [], banks: [], bankTransfers: [],
  vendors: [], customers: [], receipts: [], rentPayments: [], attendances: [], rentWaivers: [],
  payouts: [], expenses: [],
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;
let hydrating = false;
let lastSaveError: string | null = null;

export function getFinanceSyncStatus() {
  return { hydrated, hydrating, lastSaveError };
}

function snapshotFromStore(): FinanceSnapshot {
  const s = useFinance.getState();
  return {
    drivers: s.drivers, fleets: s.fleets, loans: s.loans, loanPayments: s.loanPayments,
    banks: s.banks, bankTransfers: s.bankTransfers ?? [], vendors: s.vendors, customers: s.customers,
    receipts: s.receipts, rentPayments: s.rentPayments, attendances: s.attendances, rentWaivers: s.rentWaivers,
    payouts: s.payouts, expenses: s.expenses,
  };
}

function applySnapshot(data: FinanceSnapshot) {
  useFinance.setState({
    drivers: data.drivers, fleets: data.fleets, loans: data.loans, loanPayments: data.loanPayments,
    banks: data.banks, bankTransfers: data.bankTransfers ?? [], vendors: data.vendors, customers: data.customers,
    receipts: data.receipts, rentPayments: data.rentPayments, attendances: data.attendances, rentWaivers: data.rentWaivers,
    payouts: data.payouts, expenses: data.expenses,
  });
}

/** Keep rows the user added locally that Neon does not have yet (save race). */
function mergeLocalOnlyRows(neon: FinanceSnapshot, local: FinanceSnapshot): FinanceSnapshot {
  const merge = <T extends { id: string }>(neonRows: T[], localRows: T[]): T[] => {
    const map = new Map(neonRows.map((r) => [r.id, r]));
    for (const row of localRows) {
      if (!map.has(row.id)) map.set(row.id, row);
    }
    return [...map.values()];
  };
  return {
    ...neon,
    drivers: merge(neon.drivers, local.drivers),
    fleets: merge(neon.fleets, local.fleets),
    loans: merge(neon.loans, local.loans),
    banks: merge(neon.banks, local.banks),
    vendors: merge(neon.vendors ?? [], local.vendors ?? []),
    customers: merge(neon.customers ?? [], local.customers ?? []),
    payouts: merge(neon.payouts, local.payouts),
    expenses: merge(neon.expenses, local.expenses),
    receipts: merge(neon.receipts ?? [], local.receipts ?? []),
    loanPayments: merge(neon.loanPayments ?? [], local.loanPayments ?? []),
    bankTransfers: merge(neon.bankTransfers ?? [], local.bankTransfers ?? []),
    rentPayments: merge(neon.rentPayments ?? [], local.rentPayments ?? []),
    attendances: merge(neon.attendances ?? [], local.attendances ?? []),
    rentWaivers: merge(neon.rentWaivers ?? [], local.rentWaivers ?? []),
  };
}

function localHasUserData(s: FinanceSnapshot): boolean {
  return (
    (s.payouts?.length ?? 0) + (s.expenses?.length ?? 0) + (s.drivers?.length ?? 0) + (s.banks?.length ?? 0) > 0
  );
}

async function pushSnapshot(snap: FinanceSnapshot) {
  return saveFinanceToDb({ data: snap } as never);
}

export async function hydrateFinanceFromDb(): Promise<{
  ok: boolean;
  source: "neon" | "seed-pushed" | "local";
  error?: string;
}> {
  if (hydrating) return { ok: true, source: "local" };
  hydrating = true;
  try {
    const res = await loadFinanceFromDb();
    if (!res.ok) {
      return { ok: false, source: "local", error: res.error };
    }
    const localBefore = snapshotFromStore();
    if (res.empty || !res.data) {
      if (localHasUserData(localBefore)) {
        ensureWsbLoan015AndCc();
        hydrated = true;
        void flushFinanceSave();
        return { ok: true, source: "seed-pushed" };
      }
      applySnapshot(EMPTY_FINANCE_SNAPSHOT);
      const seeded = ensureWsbLoan015AndCc();
      hydrated = true;
      if (seeded) void flushFinanceSave();
      return { ok: true, source: seeded ? "seed-pushed" : "neon" };
    }
    // Neon wins for shared ids; keep local-only advances/expenses not yet on Neon
    applySnapshot(mergeLocalOnlyRows(res.data, localBefore));
    ensureWsbLoan015AndCc();
    hydrated = true;
    void flushFinanceSave();
    return { ok: true, source: "neon" };
  } catch (e) {
    return { ok: false, source: "local", error: e instanceof Error ? e.message : String(e) };
  } finally {
    hydrating = false;
  }
}

export function scheduleFinanceSave(delayMs = 800) {
  if (!hydrated || hydrating) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flushFinanceSave();
  }, delayMs);
}

export async function flushFinanceSave(): Promise<{ ok: boolean; error?: string }> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!hydrated) return { ok: true };
  try {
    const snap = snapshotFromStore();
    const res = await pushSnapshot(snap);
    lastSaveError = res.ok ? null : res.error ?? "save failed";
    return res;
  } catch (e) {
    lastSaveError = e instanceof Error ? e.message : String(e);
    return { ok: false, error: lastSaveError };
  }
}

export function startFinanceDbSync() {
  let first = true;
  return useFinance.subscribe(() => {
    if (first) {
      first = false;
      return;
    }
    if (!hydrated || hydrating) return;
    scheduleFinanceSave();
  });
}

export async function clearAllFinanceData(): Promise<{ ok: boolean; error?: string }> {
  hydrating = true;
  try {
    const res = await clearFinanceDb();
    if (!res.ok) return res;
    applySnapshot(EMPTY_FINANCE_SNAPSHOT);
    try {
      localStorage.removeItem("satelkar-finance-v5");
      localStorage.removeItem(STMT_DELETED_KEY);
    } catch {
      // ignore
    }
    hydrated = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    hydrating = false;
  }
}

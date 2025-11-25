
// services/firebaseService.ts 
// Firestore-backed data service used by App.tsx.
// This replaces the old Supabase service but keeps the SAME function names
// App.tsx already uses (fetchSales, createSale, saveGoals, etc).

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

import { db } from "./firebaseClient";
import {
  Sale,
  OtherIncome,
  Goals,
  Consultant,
  WorkSchedule,
  ManagerGoals,
} from "../types";

// ---- Collections / helpers ----

const SALES_COLLECTION = "sales";
const OTHER_INCOME_COLLECTION = "other_income";
const CONSULTANTS_COLLECTION = "consultants";
const CONFIG_COLLECTION = "config";
const USERS_COLLECTION = "users";

// Generic config docs for goals, schedules, manager settings, etc.
const configDoc = (key: string) => doc(db, CONFIG_COLLECTION, key);

async function saveConfig<T>(key: string, value: T): Promise<void> {
  await setDoc(configDoc(key), { value }, { merge: true });
}

async function fetchConfig<T>(key: string, defaultValue: T): Promise<T> {
  const snap = await getDoc(configDoc(key));
  if (!snap.exists()) return defaultValue;
  const data = snap.data();
  if (!data) return defaultValue;

  if ("value" in data) {
    return (data as any).value as T;
  }
  return data as unknown as T;
}

// ======================== SALES ========================

export async function fetchSales(): Promise<Sale[]> {
  const snap = await getDocs(collection(db, SALES_COLLECTION));
  const sales: Sale[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const idFromDoc = Number(docSnap.id);

    sales.push({
      // use stored id if present, otherwise fallback to doc id
      id: typeof data.id === "number" ? data.id : idFromDoc,
      // cumulativeGross is recomputed in App.tsx via processSalesData
      cumulativeGross:
        typeof data.cumulativeGross === "number" ? data.cumulativeGross : 0,
      ...data,
    } as Sale);
  });
  return sales;
}

export async function createSale(
  newSale: Omit<Sale, "cumulativeGross">
): Promise<void> {
  const id = (newSale as any).id ?? Date.now();
  const ref = doc(db, SALES_COLLECTION, String(id));
  const { cumulativeGross, ...rest } = newSale as any;
  await setDoc(ref, { ...rest, id });
}

export async function updateSale(sale: Sale): Promise<void> {
  const id = sale.id ?? Date.now();
  const ref = doc(db, SALES_COLLECTION, String(id));
  const { cumulativeGross, ...rest } = sale as any;
  await setDoc(ref, { ...rest, id }, { merge: true });
}

export async function deleteSale(id: number): Promise<void> {
  const ref = doc(db, SALES_COLLECTION, String(id));
  await deleteDoc(ref);
}

// ======================== OTHER INCOME ========================

export async function fetchOtherIncome(): Promise<OtherIncome[]> {
  const snap = await getDocs(collection(db, OTHER_INCOME_COLLECTION));
  const items: OtherIncome[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const idFromDoc = Number(docSnap.id);
    items.push({
      id: typeof data.id === "number" ? data.id : idFromDoc,
      ...data,
    } as OtherIncome);
  });
  return items;
}

// App.tsx currently calls fetchOtherIncomes (plural), so keep a thin alias.
export async function fetchOtherIncomes(): Promise<OtherIncome[]> {
  return fetchOtherIncome();
}

export async function createOtherIncome(
  entry: Omit<OtherIncome, "id">
): Promise<void> {
  const id = (entry as any).id ?? Date.now();
  const ref = doc(db, OTHER_INCOME_COLLECTION, String(id));
  await setDoc(ref, { ...entry, id });
}

export async function updateOtherIncome(entry: OtherIncome): Promise<void> {
  const id = entry.id ?? Date.now();
  const ref = doc(db, OTHER_INCOME_COLLECTION, String(id));
  await setDoc(ref, entry, { merge: true });
}

export async function deleteOtherIncome(id: number): Promise<void> {
  const ref = doc(db, OTHER_INCOME_COLLECTION, String(id));
  await deleteDoc(ref);
}

// ======================== CONSULTANTS ========================

export async function fetchConsultants(): Promise<Consultant[]> {
  const snap = await getDocs(collection(db, CONSULTANTS_COLLECTION));
  const consultants: Consultant[] = [];
  snap.forEach((docSnap) => {
    consultants.push(docSnap.data() as Consultant);
  });
  return consultants;
}

// Used when the app needs an "active" consultant profile.
// For now return the first consultant if any.
export async function fetchConsultantProfile(): Promise<Consultant | null> {
  const list = await fetchConsultants();
  return list.length > 0 ? list[0] : null;
}

export async function createConsultant(consultant: Consultant): Promise<void> {
  // Use consultant.name as document id so it is stable
  const ref = doc(db, CONSULTANTS_COLLECTION, consultant.name);
  await setDoc(ref, consultant, { merge: true });
}

export async function deleteConsultant(name: string): Promise<void> {
  const ref = doc(db, CONSULTANTS_COLLECTION, name);
  await deleteDoc(ref);
}

export async function updateConsultant(
  oldName: string,
  updatedConsultant: Consultant
): Promise<void> {
  // If the name changed, delete the old doc and create the new one
  if (oldName !== updatedConsultant.name) {
    await deleteConsultant(oldName);
  }
  await createConsultant(updatedConsultant);
}

// ======================== GOALS ========================

export async function saveGoals(
  consultantName: string,
  goals: Goals
): Promise<void> {
  if (!consultantName) return;
  const key = `goals_${consultantName}`;
  await saveConfig<Goals>(key, goals);
}

export async function loadGoals(
  consultantName: string
): Promise<Goals | null> {
  if (!consultantName) return null;
  const key = `goals_${consultantName}`;
  return await fetchConfig<Goals | null>(key, null);
}

// ======================== PAY PLAN ========================
// (Kept here for future use, not currently wired heavily in App.tsx)

export interface PayPlan {
  baseSalary?: number;
  commissionRate?: number;
  // extend as needed
}

export async function savePayPlan(
  consultantName: string,
  payPlan: PayPlan
): Promise<void> {
  if (!consultantName) return;
  const key = `payPlan_${consultantName}`;
  await saveConfig<PayPlan>(key, payPlan);
}

export async function loadPayPlan(
  consultantName: string
): Promise<PayPlan | null> {
  if (!consultantName) return null;
  const key = `payPlan_${consultantName}`;
  return await fetchConfig<PayPlan | null>(key, null);
}

// ======================== SCHEDULES & MANAGER STUFF ========================

export async function saveStoreSchedules(
  schedules: Record<string, WorkSchedule>
): Promise<void> {
  await saveConfig<Record<string, WorkSchedule>>("storeSchedules", schedules);
}

export async function loadStoreSchedules(): Promise<
  Record<string, WorkSchedule>
> {
  return await fetchConfig<Record<string, WorkSchedule>>("storeSchedules", {});
}

export async function saveManagerGoals(
  goals: ManagerGoals
): Promise<void> {
  await saveConfig<ManagerGoals>("managerGoals", goals);
}

export async function loadManagerGoals(): Promise<ManagerGoals | null> {
  return await fetchConfig<ManagerGoals | null>("managerGoals", null);
}

// ===== Manager password (PIN) =====

// For now we just store the plain password (for a real production app you
// would hash this before storing).
export async function saveManagerPassword(
  password: string
): Promise<void> {
  await saveConfig<string>("managerPassword", password);
}

export async function loadManagerPassword(): Promise<string | null> {
  return await fetchConfig<string | null>("managerPassword", null);
}

export async function removeManagerPassword(): Promise<void> {
  await saveConfig<string | null>("managerPassword", null);
}

// ======================== USER PROFILES (for Auth) ========================

export type UserRole = "consultant" | "manager";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  store?: string;
  managerId?: string; // uid of manager, optional
  createdAt?: string;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const ref = doc(db, USERS_COLLECTION, profile.uid);
  await setDoc(ref, profile, { merge: true });
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function fetchManagers(): Promise<UserProfile[]> {
  const q = query(
    collection(db, USERS_COLLECTION),
    where("role", "==", "manager")
  );
  const snap = await getDocs(q);
  const managers: UserProfile[] = [];
  snap.forEach((docSnap) => managers.push(docSnap.data() as UserProfile));
  return managers;
}

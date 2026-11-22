import type { DrawnShape } from "./geo";
import type { Extras, GrassCondition, Quote } from "./pricing";

export type Role = "customer" | "cutter";
export type JobStatus = "open" | "assigned" | "in_progress" | "completed" | "cancelled";
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

export type Profile = { id: string; role: Role; full_name: string; phone: string | null };

export type CutterProfile = {
  id: string;
  base_lng: number;
  base_lat: number;
  service_radius_km: number;
  bio: string | null;
  is_active: boolean;
};

export type Job = {
  id: string;
  customer_id: string;
  status: JobStatus;
  lng: number;
  lat: number;
  shapes: DrawnShape[];
  area_m2: number;
  condition: GrassCondition;
  extras: Extras;
  quote: Quote;
  recommended_price: number;
  fair_min: number;
  fair_max: number;
  preferred_date: string | null;
  notes: string | null;
  cutter_id: string | null;
  agreed_price: number | null;
  commission_rate: number | null;
  platform_fee: number | null;
  cutter_payout: number | null;
  created_at: string;
  completed_at: string | null;
};

export type Offer = {
  id: string;
  job_id: string;
  cutter_id: string;
  amount: number;
  message: string | null;
  status: OfferStatus;
  created_at: string;
};

/** Row from the open_jobs_nearby() RPC. */
export type NearbyJob = {
  id: string;
  area_m2: number;
  condition: GrassCondition;
  extras: Extras;
  recommended_price: number;
  fair_min: number;
  fair_max: number;
  preferred_date: string | null;
  notes: string | null;
  distance_km: number;
  approx_lng: number;
  approx_lat: number;
  created_at: string;
  my_offer_id: string | null;
  my_offer_amount: number | null;
  my_offer_status: OfferStatus | null;
};

export const STATUS_LABEL: Record<JobStatus, string> = {
  open: "Waiting for offers",
  assigned: "Cutter booked",
  in_progress: "Cutting now",
  completed: "Done",
  cancelled: "Cancelled",
};

export const CONDITION_LABEL: Record<GrassCondition, string> = {
  normal: "Normal",
  long: "Long",
  overgrown: "Overgrown",
};

/** Postgres numeric columns arrive as strings or numbers depending on driver. */
export const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));

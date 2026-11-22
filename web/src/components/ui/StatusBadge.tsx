import { STATUS_LABEL, type JobStatus } from "@/lib/types";

const STYLE: Record<JobStatus, string> = {
  open: "bg-amber-100 text-amber-900",
  assigned: "bg-sky-100 text-sky-900",
  in_progress: "bg-violet-100 text-violet-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-stone-200 text-stone-700",
};

export default function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

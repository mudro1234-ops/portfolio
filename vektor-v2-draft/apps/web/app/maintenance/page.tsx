import { Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Scheduled maintenance" };

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white shadow-card">
        <EmptyState icon={<Wrench className="h-6 w-6" />} title="VEKTOR is being serviced"
          description="We are performing planned maintenance. Vehicle data from trackers is still being received and will appear when we are back." />
      </div>
    </div>
  );
}

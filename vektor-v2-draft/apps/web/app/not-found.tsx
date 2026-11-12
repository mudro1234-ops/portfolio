import { Compass } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white shadow-card">
        <EmptyState icon={<Compass className="h-6 w-6" />} title="Page not found"
          description="The page you are looking for does not exist or has moved." action={<LinkButton href="/overview">Go to workspace</LinkButton>} />
      </div>
    </div>
  );
}

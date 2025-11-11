
import { Link } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserNav } from "./UserNav";

export const AppHeader = () => {
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between whitespace-nowrap border-b border-solid border-border bg-background/80 px-4 sm:px-8 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {isMobile && <SidebarTrigger />}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Nguma"
            className="h-10 w-auto rounded-md shadow-sm"
          />
          <span className="hidden sm:inline-block text-lg font-semibold tracking-wide">
            Nguma
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <UserNav />
      </div>
    </header>
  );
};

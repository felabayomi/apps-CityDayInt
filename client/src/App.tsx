import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Library from "@/pages/library";
import Archive from "@/pages/archive";
import CityPage from "@/pages/city";
import Admin from "@/pages/admin";
import Analytics from "@/pages/analytics";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {!isAuthenticated ? (
            <Route path="/" component={Landing} />
          ) : (
            <Route path="/" component={Home} />
          )}
          <Route path="/archive" component={Archive} />
          <Route path="/city/:id" component={CityPage} />
          <Route path="/library" component={Library} />
          <Route path="/admin" component={Admin} />
          <Route path="/analytics" component={Analytics} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Custom sidebar width for travel application
  const style = {
    "--sidebar-width": "20rem",       // 320px for better content
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  return (
    <>
      {!isLoading && isAuthenticated ? (
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1">
              <header className="flex items-center justify-between p-4 border-b border-border bg-card">
                <div className="flex items-center space-x-4">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
                      <i className="fas fa-globe-americas text-white text-lg"></i>
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-foreground">Daily Felix</h1>
                      <p className="text-xs text-muted-foreground">City of the Day · International</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="hidden sm:flex items-center space-x-2 bg-accent/10 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-accent-foreground">Premium Active</span>
                  </div>
                  <button 
                    onClick={() => window.location.href = '/api/logout'}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Logout
                  </button>
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
      ) : (
        <Router />
      )}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

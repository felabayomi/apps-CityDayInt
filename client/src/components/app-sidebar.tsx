import { Calendar, Home, Settings, BarChart3, MapPin, Heart, PlusCircle } from "lucide-react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Today's City",
    url: "/",
    icon: MapPin,
  },
  {
    title: "Saved Cities",
    url: "/library",
    icon: Heart,
  },
  {
    title: "Travel Plans", 
    url: "/plans",
    icon: Calendar,
  },
];

const adminNavigation = [
  {
    title: "Admin Panel",
    url: "/admin",
    icon: Settings,
  },
  {
    title: "Analytics",
    url: "/analytics", 
    icon: BarChart3,
  },
  {
    title: "Add City",
    url: "/admin/new",
    icon: PlusCircle,
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  
  const isAdmin = user?.email?.includes('admin') || user?.email === 'wordofday2025@gmail.com';

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Explore</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <button onClick={() => setLocation(item.url)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavigation.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-admin-${item.title.toLowerCase().replace(' ', '-')}`}
                    >
                      <button onClick={() => setLocation(item.url)}>
                        <item.icon />
                        <span>{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

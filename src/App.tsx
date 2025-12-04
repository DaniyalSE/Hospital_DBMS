import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import MainLayout from "@/components/layout/MainLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Collections from "@/pages/Collections";
import CollectionView from "@/pages/CollectionView";
import Aggregations from "@/pages/Aggregations";
import Transactions from "@/pages/Transactions";
import VulnerabilityLab from "@/pages/VulnerabilityLab";
import Admin from "@/pages/Admin";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import LockingDashboard from "@/pages/LockingDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/collections/:collectionName" element={<CollectionView />} />
              <Route path="/aggregations" element={<Aggregations />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/vulnerability-lab" element={<VulnerabilityLab />} />
              <Route path="/locking" element={<LockingDashboard />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

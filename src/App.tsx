import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Profile from "./pages/Profile.tsx";
import Settings from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";
import AcceptShare from "./pages/AcceptShare.tsx";
import Privacy from "./pages/Privacy.tsx";
import Imprint from "./pages/Imprint.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* Veraltet-Overlay — nicht schließbar, Vollbild */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, hsl(36 40% 92%), hsl(14 30% 88%))",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            background: "hsl(36 25% 99%)",
            borderRadius: "1rem",
            padding: "2.5rem",
            boxShadow: "0 12px 40px -12px hsl(14 45% 42% / 0.18)",
            border: "1px solid hsl(30 15% 86%)",
          }}
        >
          <h2
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 600,
              fontSize: "1.5rem",
              color: "hsl(25 20% 15%)",
              marginBottom: "0.75rem",
              letterSpacing: "-0.01em",
            }}
          >
            Diese Version ist veraltet
          </h2>
          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: "hsl(25 10% 42%)",
              marginBottom: "1.75rem",
            }}
          >
            Fravia gibt es jetzt in einer neuen, verbesserten Version. Bitte registriere dich dort neu.
          </p>
          <a
            href="https://fravia.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: "0.95rem",
              color: "hsl(36 30% 97%)",
              background: "hsl(14 45% 42%)",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.75rem",
              textDecoration: "none",
              transition: "opacity 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.92")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Zur neuen Version →
          </a>
        </div>
      </div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/share/:token" element={<AcceptShare />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/datenschutz" element={<Privacy />} />
          <Route path="/imprint" element={<Imprint />} />
          <Route path="/impressum" element={<Imprint />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

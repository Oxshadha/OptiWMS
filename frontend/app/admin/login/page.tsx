"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { logger } from "@/lib/utils/logger";

function TypewriterText({ 
  text, 
  speed = 50, 
  delay = 0, 
  hideCursorWhenDone = false 
}: { 
  text: string, 
  speed?: number, 
  delay?: number, 
  hideCursorWhenDone?: boolean 
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [phase, setPhase] = useState<"waiting" | "typing" | "done">("waiting");
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const timeout = setTimeout(() => {
      setPhase("typing");
      let i = 0;
      interval = setInterval(() => {
        if (i <= text.length) {
          setDisplayedText(text.substring(0, i));
          i++;
        } else {
          clearInterval(interval);
          setPhase("done");
        }
      }, speed);
    }, delay);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [text, speed, delay]);

  return (
    <span>
      {displayedText}
      {phase !== "waiting" && (!hideCursorWhenDone || phase !== "done") && (
        <span className={`text-primary font-light ml-1 ${phase === "done" ? "animate-pulse" : ""}`}>|</span>
      )}
    </span>
  );
}

function AnimatedHeroText() {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setKey(prev => prev + 1);
    }, 12000); // Loop every 12 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div key={key} className="flex flex-col items-start w-full mt-2">
      <h1 className="text-4xl lg:text-[2.75rem] leading-[1.1] font-bold mb-6 tracking-tight flex flex-col gap-2 min-h-[96px]">
        <span className="text-white">
          <TypewriterText text="Intelligent Warehouse" speed={50} delay={0} hideCursorWhenDone={true} />
        </span>
        <span className="text-primary">
          <TypewriterText text="Management System" speed={50} delay={1200} hideCursorWhenDone={true} />
        </span>
      </h1>
      <p className="text-lg lg:text-lg text-white/80 max-w-md min-h-[84px] leading-relaxed">
        <TypewriterText 
          text="Optimize your supply chain, empower your workforce, and deliver operational excellence." 
          speed={30} 
          delay={2200} 
        />
      </p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isAdmin, refreshAuth } = useAuth();
  const { setAdmin } = useAdmin();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [availableWarehouses, setAvailableWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);

  // Load warehouses from API
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setLoadingWarehouses(true);
        const { warehousesApi } = await import("@/lib/api/warehouses");
        const warehouses = await warehousesApi.getAll();
        setAvailableWarehouses(warehouses.map(w => ({ id: w.id, name: w.name })));
      } catch (error) {
        logger.error("Failed to load warehouses:", error);
        // Fallback to empty array if API fails
        setAvailableWarehouses([]);
      } finally {
        setLoadingWarehouses(false);
      }
    };
    loadWarehouses();
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (isAdmin && user) {
      router.replace("/admin/dashboard");
    }
  }, [isAdmin, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!formData.email || !formData.password) {
      setError("Please enter email and password");
      setIsLoading(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    try {
      // Use centralized auth login
      const result = await login(formData.email, formData.password);
      
      if (!result.success) {
        setError(result.error || "Invalid email or password");
        setIsLoading(false);
        return;
      }

      // Refresh auth state to get updated user info
      await refreshAuth();
      
      // Wait a bit for auth state to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Check if user is admin - we need to check the role from the login response
      // Since we can't access user state immediately, we'll check via API
      try {
        const { authApi } = await import("@/lib/api/auth");
        const userInfo = await authApi.getCurrentUser();
        // Normalize role (remove ROLE_ prefix if present, like "role_admin" -> "admin")
        let userRole = userInfo.role?.toLowerCase() || '';
        if (userRole.startsWith('role_')) {
          userRole = userRole.substring(5); // Remove "role_" prefix
        }
        const adminRoles = ['admin', 'warehouse_manager', 'inbound_coordinator'];
        
        if (!userRole || !adminRoles.includes(userRole)) {
          // Logout the non-admin user
          const { authApi } = await import("@/lib/api/auth");
          await authApi.logout();
          setError(`Access denied. This account (role: ${userRole || 'unknown'}) is not authorized for admin portal.`);
          setIsLoading(false);
          return;
        }

        // Get full user details and update admin context
        const { usersApi } = await import("@/lib/api/users");
        const fullUser = await usersApi.getById(userInfo.userId);
        
        let warehouseName: string | undefined;
        if (fullUser.warehouseId) {
          try {
            const selectedWarehouse = availableWarehouses.find(w => w.id === fullUser.warehouseId);
            if (selectedWarehouse) {
              warehouseName = selectedWarehouse.name;
            }
          } catch (err) {
            logger.error("Error fetching warehouse:", err);
          }
        }

        const adminData = {
          id: fullUser.id,
          name: `${fullUser.firstName || ''} ${fullUser.lastName || ''}`.trim() || fullUser.username,
          email: fullUser.email || userInfo.email,
          role: fullUser.role as any,
          avatar: fullUser.avatarUrl || "/assets/avatars/Henry Kual.jpg",
          ...(fullUser.warehouseId && {
            warehouseId: fullUser.warehouseId,
            warehouseName: warehouseName,
          }),
        };
        setAdmin(adminData);
      } catch (apiError) {
        logger.error("Error verifying admin role:", apiError);
        setError("Failed to verify user role. Please try again.");
        setIsLoading(false);
        return;
      }
      
      setIsLoading(false);
      
      // Redirect to dashboard
      router.replace("/admin/dashboard");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      // Show user-friendly error messages
      if (errorMessage.includes("Invalid") || errorMessage.includes("credentials")) {
        setError("Invalid email or password");
      } else if (errorMessage.includes("401")) {
        setError("Invalid email or password");
      } else {
        setError("Login failed. Please try again.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-base-100">
      {/* Left side - Branding (Dark Theme with Image) */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/assets/logos/Login main .png"
            alt="Warehouse Background"
            fill
            className="object-cover"
            priority
          />
          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a]/95 via-[#0f172a]/80 to-transparent"></div>
        </div>
        
        <div className="relative z-10 flex flex-col items-start w-full px-12 xl:px-20 max-w-3xl -mt-20">
          <Image
            src="/assets/logos/OptiWMS Logo.png?v=5"
            alt="OptiWMS Logo"
            width={400}
            height={133}
            className="object-contain w-48 lg:w-56 xl:w-64 h-auto drop-shadow-2xl transition-transform duration-500 hover:scale-105 origin-left mb-2"
            priority
          />
          <AnimatedHeroText />
        </div>
      </div>

      {/* Right side - Login Form (Light Theme) */}
      <div className="w-full lg:w-[45%] flex flex-col items-center justify-center p-8 sm:p-12 lg:p-16 relative bg-base-100">
        <div className="w-full max-w-md relative z-10 flex-1 flex flex-col justify-center">
          {/* Mobile Logo with dark background for visibility */}
          <div className="lg:hidden flex justify-center mb-10">
            <div className="bg-neutral w-36 h-36 rounded-[2rem] shadow-2xl hover:scale-105 transition-transform duration-300 flex items-center justify-center">
              <Image
                src="/assets/logos/OptiWMS Logo.png?v=5"
                alt="OptiWMS Logo"
                width={200}
                height={100}
                className="object-contain w-[85%] h-auto"
                priority
              />
            </div>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold mb-2 text-base-content tracking-tight">Welcome Back</h2>
            <p className="text-base-content/60 text-lg">Sign in to access your administrative workspace.</p>
          </div>

          {error && (
            <div className="alert alert-error mb-6 shadow-sm rounded-xl">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control">
              <label className="label pb-2">
                <span className="label-text font-medium text-base-content/80">Email Address</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/40">
                  <span className="material-symbols-outlined text-xl">mail</span>
                </div>
                <input
                  type="email"
                  className="input input-bordered w-full pl-12 bg-base-100 hover:border-primary focus:border-primary transition-colors h-14 rounded-xl"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            
            <div className="form-control">
              <label className="label pb-2">
                <span className="label-text font-medium text-base-content/80">Password</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/40">
                  <span className="material-symbols-outlined text-xl">lock</span>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="input input-bordered w-full pl-12 pr-12 bg-base-100 hover:border-primary focus:border-primary transition-colors h-14 rounded-xl"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-circle btn-sm absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between pb-2">
              <label className="label cursor-pointer justify-start gap-3 p-0">
                <input type="checkbox" className="checkbox checkbox-primary checkbox-sm rounded-md" />
                <span className="label-text text-base-content/70">Remember me</span>
              </label>
              <a href="#" className="text-sm text-primary hover:text-primary-focus font-medium transition-colors">
                Forgot Password?
              </a>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full h-14 rounded-xl text-lg font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all border-0" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-md"></span>
                  Authenticating...
                </>
              ) : (
                "Sign In to Dashboard"
              )}
            </button>
          </form>
        </div>
        
        {/* Footer Art Image */}
        <div className="hidden lg:block absolute bottom-10 right-0 w-full pointer-events-none opacity-60 z-0">
           <Image
             src="/assets/logos/admin login page art.png"
             alt="Login Art"
             width={800}
             height={300}
             className="w-full h-auto object-contain object-bottom"
           />
        </div>

        {/* Copyright Text */}
        <div className="absolute bottom-3 w-full text-center text-sm text-base-content/40 z-10">
          &copy; {new Date().getFullYear()} OptiWMS Inc. All rights reserved.
        </div>
      </div>
    </div>
  );
}

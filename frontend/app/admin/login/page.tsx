"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle login logic here
    console.log("Login attempt:", { email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-300">
      <div className="w-full max-w-md px-4">
        {/* Logo and System Name */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-lg mb-4 flex items-center justify-center shadow-lg">
            <span className="text-3xl font-bold text-primary-content">O</span>
          </div>
          <h1 className="text-4xl font-bold text-base-content">OptiWMS</h1>
          <p className="text-sm text-base-content/60 mt-2">Warehouse Management System</p>
        </div>

        {/* Login Form */}
        <div className="card w-full shadow-xl bg-base-100 border border-base-300 rounded-xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-base-content">Admin Login</h2>
            <p className="text-sm text-base-content/60 mt-2">Enter your credentials to access the system</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Email</span>
              </label>
              <label className="input input-bordered flex items-center gap-2">
                <span className="material-symbols-outlined text-base-content/60">email</span>
                <input
                  type="email"
                  className="grow"
                  placeholder="admin@optiwms.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Password</span>
              </label>
              <label className="input input-bordered flex items-center gap-2">
                <span className="material-symbols-outlined text-base-content/60">lock</span>
                <input
                  type="password"
                  className="grow"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="label cursor-pointer">
                <input type="checkbox" className="checkbox checkbox-sm" />
                <span className="label-text ml-2">Remember me</span>
              </label>
              <a href="#" className="link link-primary text-sm">Forgot password?</a>
            </div>

            <button type="submit" className="btn btn-primary w-full">
              <span className="material-symbols-outlined">login</span>
              Login
            </button>
          </form>

          <div className="divider text-sm text-base-content/60">OR</div>

          <div className="text-center text-sm text-base-content/60">
            Need help? <a href="/admin/help" className="link link-primary">Contact Support</a>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-base-content/60">
          © 2025 OptiWMS. All rights reserved.
        </div>
      </div>
    </div>
  );
}

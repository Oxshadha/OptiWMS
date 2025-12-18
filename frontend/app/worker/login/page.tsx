import Image from "next/image";

export default function WorkerLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="w-full max-w-md">
        {/* Logo and System Name */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-lg mb-4 flex items-center justify-center overflow-hidden" style={{ backgroundColor: "#EEEEEE" }}>
            <Image
              src="/assets/logos/OptiWMS Logo.JPG"
              alt="OptiWMS Logo"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-base-content">OptiWMS</h1>
          <p className="text-sm text-base-content/60 mt-2">Worker Portal</p>
        </div>

        {/* Login Form */}
        <div className="card w-full shadow-lg bg-base-100 p-8 space-y-6">
          <h2 className="text-2xl font-semibold text-center text-base-content">Worker Login</h2>
          <div className="space-y-4">
            <input 
              className="input input-bordered w-full" 
              placeholder="Employee ID" 
            />
            <input 
              className="input input-bordered w-full" 
              placeholder="Password" 
              type="password" 
            />
            <button className="btn btn-primary w-full">Login</button>
          </div>
        </div>
      </div>
    </div>
  );
}



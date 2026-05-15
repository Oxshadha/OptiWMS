'use client';

export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import AdvancedPickingInterface from '@/components/AdvancedPickingInterface';

export default function AdvancedPickingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const customerId = searchParams.get('customerId');

  const handleReturnToDashboard = () => {
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-950 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Advanced Picking Interface</h1>
            {orderId && (
              <p className="text-slate-400 text-sm mt-1">
                Order {orderId} • Customer: {customerId || 'Unknown'}
              </p>
            )}
          </div>
          <button
            onClick={handleReturnToDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Content */}
      <AdvancedPickingInterface orderId={orderId} customerId={customerId} />
    </main>
  );
}

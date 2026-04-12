import { useParams, Link } from 'react-router-dom';
import { useDashboardData } from '@/contexts/DashboardDataContext';
import { ProductionRouteMap } from '@/components/tracking/ProductionRouteMap';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function TrackingPage() {
  const { deliveryId } = useParams();
  const { deliveries, driverLocations, drivers, warehouse, isLoading, loadError } = useDashboardData();

  const delivery = deliveries.find(d => d.id === deliveryId);
  
  if (!delivery && !isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center bg-slate-50">
        <div className="p-10 rounded-[40px] bg-white shadow-2xl text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900">Route Inactive</h2>
          <p className="text-slate-500 font-medium">This delivery ID is no longer active or hasn't been assigned to a live route yet.</p>
          <Link to="/deliveries" className="group flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-emerald-600 transition-all">
            <span>Back to Mission Control</span>
          </Link>
        </div>
      </div>
    );
  }

  const driverDeliveries = delivery?.assignedDriverId 
    ? deliveries.filter(d => d.assignedDriverId === delivery.assignedDriverId)
    : delivery ? [delivery] : [];

  const driverLocation = driverLocations.find(l => l.driverId === delivery?.assignedDriverId);
  const driver = drivers.find(d => d.id === delivery?.assignedDriverId);

  if (isLoading) return <LoadingSpinner label="Initializing Fleet Intelligence..." />;
  if (loadError) return <div className="p-8 text-red-600">{loadError}</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] lg:flex-row gap-6 bg-slate-50 p-6 overflow-hidden">
      {/* Precision Tracking Panel */}
      <div className="w-full lg:w-[420px] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
        <div className="rounded-[48px] bg-slate-900 p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] text-white space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <Link to="/deliveries" className="p-3 bg-white/10 hover:bg-emerald-500 rounded-2xl transition-all group">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" className="group-hover:scale-110 transition-transform"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </Link>
            <div className="flex flex-col items-end">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Status</span>
               <span className="text-xs font-black bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/30">
                 {delivery?.status.replace('_', ' ').toUpperCase()}
               </span>
            </div>
          </div>

          <div className="space-y-2 relative z-10">
            <h1 className="text-4xl font-black tracking-tight leading-none uppercase">
              Fleet <span className="text-emerald-500">Track</span>
            </h1>
            <p className="text-slate-400 font-mono text-xs">LOGISTICS ID: {delivery?.id.slice(0, 12)}</p>
          </div>

          {/* Delivery Points */}
          <div className="space-y-8 relative z-10 pt-4">
             <div className="flex gap-6">
                <div className="flex flex-col items-center">
                   <div className="w-5 h-5 rounded-full bg-emerald-500 border-4 border-slate-900 shadow-[0_0_15px_#10b981]"></div>
                   <div className="w-1 flex-1 bg-gradient-to-b from-emerald-500 to-orange-500 my-2 rounded-full opacity-20"></div>
                   <div className="w-5 h-5 rounded-full bg-orange-500 border-4 border-slate-900 shadow-[0_0_15px_#f97316]"></div>
                </div>
                <div className="flex-1 space-y-10">
                   <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Dispatch Point</p>
                      <p className="font-black text-lg">Central Depot</p>
                      <p className="text-xs text-slate-400 leading-tight">{warehouse?.address}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Active Target</p>
                      <p className="font-black text-xl text-orange-400">{delivery?.recipientName}</p>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">{delivery?.address}</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Driver Card */}
          {driver ? (
            <div className="bg-white/5 border border-white/10 rounded-[36px] p-6 flex items-center gap-5 relative z-10">
               <div className="w-16 h-16 rounded-3xl bg-emerald-500 flex items-center justify-center text-slate-900 shadow-xl shadow-emerald-500/20">
                  <span className="font-black text-2xl tracking-tighter">{driver.name[0]}</span>
               </div>
               <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Operator</p>
                  <p className="text-xl font-black leading-none mb-1">{driver.name}</p>
                  <p className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10 w-fit px-2 py-0.5 rounded-md">
                    {driver.vehicleLabel}
                  </p>
               </div>
               {driver.phone && (
                  <a href={`tel:${driver.phone}`} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.28-2.28a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </a>
               )}
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[36px] p-8 text-center space-y-3 relative z-10">
               <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                 <svg class="text-amber-500 w-6 h-6" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
               </div>
               <p className="text-sm font-black text-amber-500 uppercase tracking-widest">Unassigned Unit</p>
            </div>
          )}

          <div className="pt-2 text-center opacity-40">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em]">Operational Intel System v2.0</p>
          </div>
        </div>
      </div>

      {/* Map View */}
      <div className="flex-1 min-h-[500px] h-full relative">
        <ProductionRouteMap 
          driverDeliveries={driverDeliveries}
          activeDeliveryId={deliveryId}
          driverLocation={driverLocation}
          warehouse={warehouse}
          className="h-full w-full shadow-[0_32px_80px_-20px_rgba(0,0,0,0.15)] rounded-[60px] overflow-hidden border-8 border-white"
        />
      </div>
    </div>
  );
}

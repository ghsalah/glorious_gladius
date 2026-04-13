import { useParams, useNavigate } from 'react-router-dom';
import { useDashboardData } from '@/contexts/DashboardDataContext';
import { ProductionRouteMap } from '@/components/tracking/ProductionRouteMap';
import { RouteTimeline } from '@/components/tracking/RouteTimeline';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const GREEN = 'rgb(0, 153, 102)';

export function TrackingPage() {
  const { deliveryId } = useParams();
  const navigate = useNavigate();
  const { deliveries, driverLocations, drivers, warehouse, isLoading, loadError } = useDashboardData();

  const delivery = deliveries.find(d => d.id === deliveryId);

  if (isLoading) return <LoadingSpinner label="Loading tracking data..." />;
  if (loadError) return <div className="p-4 text-red-600 font-medium">{loadError}</div>;

  if (!delivery) {
    return (
      <div className="flex h-screen items-center justify-center bg-white p-8">
        <div className="w-full max-w-md border border-slate-200 p-10 text-center">
          <h2 className="text-2xl font-bold text-black mb-4 uppercase tracking-tight">Route not found</h2>
          <p className="text-slate-500 mb-8">This delivery is no longer active or hasn't been assigned yet.</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-4 bg-black text-white font-bold hover:bg-[#009966] transition-colors uppercase tracking-widest text-xs"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const driverDeliveries = delivery.assignedDriverId
    ? deliveries.filter(d => d.assignedDriverId === delivery.assignedDriverId)
    : [delivery];

  const driverLocation = driverLocations.find(l => l.driverId === delivery.assignedDriverId);
  const driver = drivers.find(d => d.id === delivery.assignedDriverId);

  return (
    <div className="flex flex-col h-screen lg:flex-row bg-white text-black overflow-hidden border-t border-slate-100">
      
      {/* Left Panel: Control Interface */}
      <div className="w-full lg:w-[360px] flex flex-col border-r border-slate-200">
        
        {/* Navigation Header */}
        <div className="p-5 border-b border-slate-200 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold uppercase tracking-widest leading-none">Fleet Tracking</h1>
            <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">ID: {delivery.id.slice(0, 12)}</p>
          </div>
          <span className="text-[9px] font-black px-2 py-1 border border-[#009966] text-[#009966] uppercase">
            {delivery.status.replace('_', ' ')}
          </span>
        </div>

        {/* Tactical Timeline */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white">
          <div className="mb-4">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Timeline</p>
             <h2 className="text-lg font-black uppercase">Sequence</h2>
          </div>
          <RouteTimeline
            deliveries={driverDeliveries}
            driverLocation={driverLocation}
            warehouse={warehouse}
            className="text-black"
          />
        </div>

        {/* Operator Profile */}
        <div className="p-5 border-t border-slate-200 bg-slate-50/50">
          {driver ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-bold text-lg shrink-0">
                {driver.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Driver</p>
                <p className="text-sm font-bold truncate leading-none uppercase">{driver.name}</p>
                <p className="text-[10px] font-medium text-[#009966] mt-1">{driver.vehicleLabel}</p>
              </div>
              {driver.phone && (
                <a href={`tel:${driver.phone}`} className="w-10 h-10 border border-slate-200 flex items-center justify-center hover:bg-white transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.28-2.28a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </a>
              )}
            </div>
          ) : (
            <div className="p-4 border border-dashed border-slate-200 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widestAlpha">
              Unit Unassigned
            </div>
          )}
        </div>
      </div>

      {/* Map View Matrix */}
      <div className="flex-1 relative bg-slate-50">
        <ProductionRouteMap
          driverDeliveries={driverDeliveries}
          activeDeliveryId={deliveryId}
          driverLocation={driverLocation}
          warehouse={warehouse}
          className="h-full w-full"
        />
        
        {/* Map Information Layer */}
        <div className="absolute top-6 left-6 bg-white border border-slate-200 p-4 z-10 pointer-events-none shadow-sm">
           <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-[#009966]"></div>
              <p className="text-[9px] font-bold text-black uppercase tracking-[0.2em]">Map Live Feed</p>
           </div>
           <p className="text-[11px] font-black uppercase text-slate-400">Tactical Route Active</p>
        </div>
      </div>

    </div>
  );
}

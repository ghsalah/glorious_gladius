import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DeliveriesMap } from '@/components/DeliveriesMap';
import type { Driver, Delivery, DriverLocation, WarehouseDepot } from '@/types';

const GREEN = 'rgb(0, 153, 102)';

interface FleetControlCenterProps {
  drivers: Driver[];
  deliveries: Delivery[];
  driverLocations: DriverLocation[];
  warehouse: WarehouseDepot | null;
}

export function FleetControlCenter({ drivers, deliveries, driverLocations, warehouse }: FleetControlCenterProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const activeDrivers = useMemo(() => drivers.filter(d => d.isActive), [drivers]);

  return (
    <div className="flex flex-col xl:flex-row gap-0 border border-slate-200 bg-white min-h-[600px] h-[750px]">
      
      {/* Sidebar: Driver Control Panel */}
      <div className="w-full xl:w-[360px] flex flex-col border-r border-slate-200 bg-white">
        <div className="p-6 border-b border-slate-200">
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#009966] mb-1">Fleet Management</p>
           <h3 className="text-xl font-black text-black uppercase tracking-tight">Driver <span className="text-[#009966]">Status</span></h3>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeDrivers.map(driver => {
            const isSelected = selectedDriverId === driver.id;
            const location = driverLocations.find(l => l.driverId === driver.id);
            const driverStops = deliveries.filter(d => d.assignedDriverId === driver.id);
            const completedStops = driverStops.filter(d => d.status === 'completed').length;
            const totalStops = driverStops.length;
            const progressPercent = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
            const isOnline = !!location;

            return (
              <div
                key={driver.id}
                onClick={() => setSelectedDriverId(isSelected ? null : driver.id)}
                className={`
                  p-6 cursor-pointer border-b border-slate-100 transition-all
                  ${isSelected ? 'bg-slate-50 border-l-4 border-l-[#009966]' : 'hover:bg-slate-50/50'}
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 flex items-center justify-center font-bold text-lg shrink-0 ${isSelected ? 'bg-[#009966] text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {driver.name[0]}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className="font-bold text-black text-sm truncate uppercase">{driver.name}</h4>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isOnline ? 'text-[#009966]' : 'text-slate-400'}`}>
                        {isOnline ? 'Live' : 'Offline'}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{driver.vehicleLabel}</p>
                    <div className="flex gap-2 mt-2">
                       <span className={`text-[8px] font-black px-1.5 py-0.5 border ${driver.onDuty ? 'border-[#009966] text-[#009966]' : 'border-slate-200 text-slate-300'} uppercase`}>
                          {driver.onDuty ? 'Shift On' : 'Shift Off'}
                       </span>
                    </div>
                  </div>
                </div>

                {/* Linear Progress Indicator */}
                <div className="mt-4">
                   <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase mb-1">
                      <span>Progress</span>
                      <span className="text-[#009966]">{completedStops}/{totalStops}</span>
                   </div>
                   <div className="h-1 bg-slate-100 w-full overflow-hidden">
                      <div 
                        className="h-full bg-[#009966] transition-all duration-1000"
                        style={{ width: `${progressPercent}%` }}
                      />
                   </div>
                </div>

                {isSelected && (
                  <div className="mt-5 flex gap-2 pt-4 border-t border-slate-200">
                    <Link
                      to={`/tracking/${driverStops.find(d => d.status === 'in_progress')?.id || driverStops[0]?.id}`}
                      className="flex-1 py-2 bg-black text-white text-center text-[10px] font-bold uppercase tracking-widest hover:bg-[#009966]"
                      onClick={(e) => !driverStops.length && e.preventDefault()}
                    >
                      Open Track
                    </Link>
                    {driver.phone && (
                      <a href={`tel:${driver.phone}`} className="px-3 py-2 border border-slate-200 flex items-center justify-center hover:bg-white text-slate-400 hover:text-black">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.28-2.28a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Map Content Area */}
      <div className="flex-1 relative bg-slate-50">
        <DeliveriesMap
          deliveries={deliveries}
          driverLocations={driverLocations}
          onlyDriverId={selectedDriverId}
          warehouse={warehouse}
          showGreedyRoutesPerDriver={!selectedDriverId}
          className="h-full w-full"
        />
        
        {/* Map Header Status */}
        <div className="absolute top-6 left-6 bg-white border border-slate-200 p-4 z-10 pointer-events-none shadow-sm">
           <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 ${selectedDriverId ? 'bg-blue-600' : 'bg-[#009966]'}`}></div>
              <p className="text-[9px] font-bold text-black uppercase tracking-[0.2em]">Map Registry</p>
           </div>
           <p className="text-[10px] font-black uppercase text-slate-400">
             {selectedDriverId ? 'Unit Focus Active' : 'Fleet Wide Visibility'}
           </p>
        </div>
      </div>

    </div>
  );
}

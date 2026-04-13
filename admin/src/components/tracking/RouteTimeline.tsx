import { useMemo } from 'react';
import type { Delivery, DriverLocation, WarehouseDepot } from '@/types';

interface RouteTimelineProps {
  deliveries: Delivery[];
  driverLocation?: DriverLocation;
  warehouse: WarehouseDepot | null;
  className?: string;
}

export function RouteTimeline({ deliveries, driverLocation, warehouse, className = '' }: RouteTimelineProps) {
  const sortedStops = useMemo(() => {
    return [...deliveries].sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
  }, [deliveries]);

  const activeIndex = sortedStops.findIndex(s => s.status === 'in_progress');
  const lastCompletedIndex = [...sortedStops].reverse().findIndex(s => s.status === 'completed');
  const currentStopIndex = activeIndex !== -1 ? activeIndex : (lastCompletedIndex !== -1 ? sortedStops.length - 1 - lastCompletedIndex : -1);

  // Helper to format time safely
  const formatTime = (dateStr: string, offsetMinute: number) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '--:--';
      d.setMinutes(d.getMinutes() + offsetMinute);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header Info */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1 opacity-80">Route Progress</p>
          <h3 className="text-base font-black text-white leading-none uppercase">Sequence <span className="text-emerald-500">Timeline</span></h3>
        </div>
      </div>

      {/* Timeline Columns Header */}
      <div className="flex text-[9px] font-black uppercase tracking-widest text-slate-600 mb-4 px-2">
        <div className="w-16 text-left">Arr.</div>
        <div className="flex-1 text-center">Stop Point</div>
        <div className="w-16 text-right">Dep.</div>
      </div>

      {/* Vertical Timeline Container */}
      <div className="relative">
        {/* The connecting line */}
        <div className="absolute left-[72px] top-6 bottom-6 w-0.5 bg-slate-800 rounded-full">
           <div 
             className="absolute top-0 w-full bg-emerald-500 rounded-full transition-all duration-1000"
             style={{ height: `${Math.max(0, ((currentStopIndex + 1) / (sortedStops.length + 1)) * 100)}%` }}
           />
        </div>

        {/* Start Point */}
        <TimelineNode 
          title="Warehouse Depot"
          subtitle="Mission Launch"
          arrival="START"
          departure="08:00 AM"
          status={currentStopIndex >= -1 ? 'completed' : 'pending'}
          isFirst
        />

        {/* Sorted Delivery Stops */}
        {sortedStops.map((stop, index) => {
          const isDone = stop.status === 'completed';
          const isAt = stop.status === 'in_progress';
          const nodeStatus = isDone ? 'completed' : isAt ? 'active' : 'pending';

          const displayName = stop.recipientName ? stop.recipientName.split(' ')[0] : 'Unknown';
          const displayAddress = stop.address ? stop.address.split(',')[0] : 'No Address';
          const arrivalTime = stop.createdAt ? formatTime(stop.createdAt, (index + 1) * 25) : '--:--';
          const departureTime = stop.createdAt ? formatTime(stop.createdAt, (index + 1) * 25 + 5) : '--:--';

          return (
            <TimelineNode 
              key={stop.id}
              title={displayName}
              subtitle={displayAddress}
              arrival={arrivalTime}
              departure={departureTime}
              status={nodeStatus}
              isHighlight={isAt}
            />
          );
        })}

        {/* End Point (Return) */}
        <TimelineNode 
          title="Return to Base"
          subtitle="Cycle Completion"
          arrival="05:00 PM"
          departure="FINISH"
          status={sortedStops.every(s => s.status === 'completed') ? 'active' : 'pending'}
          isLast
        />

        {/* Live Status Card (Floating) */}
        {driverLocation && (
          <div 
            className="absolute -left-4 right-0 z-20 transition-all duration-1000 ease-in-out pointer-events-none"
            style={{ 
              top: `${((currentStopIndex + 1.5) / (sortedStops.length + 2)) * 100}%`,
              transform: 'translateY(-50%)' 
            }}
          >
             <div className="flex justify-center">
                <div className="bg-slate-900/95 backdrop-blur-md rounded-xl p-3 shadow-2xl border border-white/10 min-w-[200px] pointer-events-auto">
                   <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Live Trace</p>
                      <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                         <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                         <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Verified</span>
                      </div>
                   </div>
                   <p className="text-xs font-bold text-white leading-tight">
                     {activeIndex !== -1 
                       ? `Target: ${sortedStops[activeIndex].recipientName}`
                       : 'Returning to Base'}
                   </p>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineNode({ 
  title, 
  subtitle, 
  arrival, 
  departure, 
  status,
  isHighlight = false
}: { 
  title: string; 
  subtitle: string; 
  arrival: string; 
  departure: string;
  status: 'completed' | 'active' | 'pending';
  isFirst?: boolean;
  isLast?: boolean;
  isHighlight?: boolean;
}) {
  const isDone = status === 'completed';
  const isActive = status === 'active';

  return (
    <div className={`flex items-center gap-2 py-4 relative transition-all duration-500 ${isHighlight ? 'opacity-100' : 'opacity-60'}`}>
      {/* Arrival Column */}
      <div className="w-16 text-left">
        <p className={`text-[10px] font-black tracking-tighter ${isDone ? 'text-emerald-500' : isActive ? 'text-amber-500' : 'text-slate-600'}`}>
          {arrival}
        </p>
      </div>

      {/* Timeline Node */}
      <div className="w-4 flex flex-col items-center">
        <div className={`
          z-10 w-2 h-2 rounded-full transition-all duration-700
          ${isDone ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 
            isActive ? 'bg-amber-500 scale-125 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 
            'bg-slate-800'}
        `} />
      </div>

      {/* Stop Info & Departure */}
      <div className="flex-1 flex justify-between items-center pl-2">
        <div className="flex-1 min-w-0">
          <h4 className={`text-xs font-bold truncate ${isDone ? 'text-slate-500' : isActive ? 'text-white' : 'text-slate-400'}`}>
            {title}
          </h4>
          <p className="text-[9px] font-medium text-slate-600 truncate uppercase mt-0.5">{subtitle}</p>
        </div>

        <div className="w-16 text-right">
          <p className={`text-[10px] font-black tracking-tighter ${isDone ? 'text-emerald-500' : isActive ? 'text-amber-500' : 'text-slate-600'}`}>
            {departure}
          </p>
        </div>
      </div>
    </div>
  );
}

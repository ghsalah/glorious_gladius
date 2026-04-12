import React, { useState, useEffect, useRef } from 'react';

interface AddressAutocompleteProps {
  onSelect: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
  className?: string;
}

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

export function AddressAutocomplete({ onSelect, placeholder, className }: AddressAutocompleteProps) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (input.length < 3) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(input)}&apiKey=${GEOAPIFY_API_KEY}`);
        const data = await res.json();
        setResults(data.features || []);
        setIsOpen(true);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder || 'Search address...'}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
      />
      
      {isOpen && results.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {results.map((feature, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                const { properties, geometry } = feature;
                setInput(properties.formatted);
                setResults([]);
                setIsOpen(false);
                onSelect(properties.formatted, geometry.coordinates[1], geometry.coordinates[0]);
              }}
              className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-none group flex items-start gap-3"
            >
              <div className="mt-0.5 p-1.5 bg-slate-100 rounded-md group-hover:bg-emerald-100 transition-colors">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" className="text-slate-500 group-hover:text-emerald-600"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="font-semibold text-slate-900 truncate">{feature.properties.formatted.split(',')[0]}</p>
                <p className="text-[10px] text-slate-500 truncate">{feature.properties.formatted}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

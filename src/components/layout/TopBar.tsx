'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

// Bitcoin icon component
function BitcoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c1.77-.45 2.34-1.94 2.18-2.93-.21-1.32-1.38-1.96-3.14-2.1V4.5h-1.3v1.53c-.34 0-.68.01-1.02.02V4.5h-1.3v1.62c-.28.01-.56.02-.83.02H5v1.36h.97c.38 0 .65.25.65.65v5.53c0 .29-.22.51-.51.51h-.97l-.24 1.56h1.81c.34 0 .67.01 1 .02v1.62h1.3v-1.58c.35.01.69.01 1.02.01v1.57h1.3v-1.63c2.09-.17 3.54-.82 3.78-2.5.19-1.35-.51-1.96-1.52-2.2zm-3.01-3.25c1.02 0 2.35-.08 2.35 1.08 0 1.07-1.33 1.08-2.35 1.08v-2.16zm0 6.39v-2.35c1.23 0 2.82-.06 2.82 1.17 0 1.18-1.59 1.18-2.82 1.18z"/>
    </svg>
  );
}

export function TopBar() {
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBtcPrice = async () => {
      try {
        // Fetch BTC/MXN from Binance API
        const response = await fetch(
          'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'
        );
        const data = await response.json();

        // Get USD/MXN rate
        const forexResponse = await fetch(
          'https://api.exchangerate-api.com/v4/latest/USD'
        );
        const forexData = await forexResponse.json();
        const usdToMxn = forexData.rates?.MXN || 17.5;

        const priceInMxn = parseFloat(data.lastPrice) * usdToMxn;
        setBtcPrice(priceInMxn);
        setPriceChange(parseFloat(data.priceChangePercent));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching BTC price:', error);
        setLoading(false);
      }
    };

    fetchBtcPrice();
    const interval = setInterval(fetchBtcPrice, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06]">
      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-4 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md text-sm text-white placeholder-white/30 focus:border-white/20 transition-colors"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-6">
        {/* BTC Price */}
        <div className="flex items-center gap-2">
          <BitcoinIcon className="w-5 h-5 text-orange-400" />
          <div className="flex flex-col">
            {loading ? (
              <span className="text-sm text-white/50">Cargando...</span>
            ) : btcPrice ? (
              <>
                <span className="text-sm font-mono text-white/90">
                  {formatPrice(btcPrice)}
                </span>
                <span
                  className={`text-[10px] font-mono ${
                    priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="text-sm text-white/50">--</span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-xs text-white/40">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>SPEI conectado</span>
        </div>
      </div>
    </header>
  );
}

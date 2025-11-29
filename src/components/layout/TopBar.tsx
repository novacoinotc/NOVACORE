'use client';

import { Search, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceKey, setPriceKey] = useState(0);

  useEffect(() => {
    const fetchBtcPrice = async () => {
      try {
        const response = await fetch(
          'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'
        );
        const data = await response.json();

        const forexResponse = await fetch(
          'https://api.exchangerate-api.com/v4/latest/USD'
        );
        const forexData = await forexResponse.json();
        const usdToMxn = forexData.rates?.MXN || 17.5;

        const priceInMxn = parseFloat(data.lastPrice) * usdToMxn;
        setBtcPrice(priceInMxn);
        setPriceChange(parseFloat(data.priceChangePercent));
        setPriceKey(prev => prev + 1);
      } catch (error) {
        console.error('Error fetching BTC price:', error);
      }
    };

    fetchBtcPrice();
    const interval = setInterval(fetchBtcPrice, 5000);
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
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-white/[0.06]">
      {/* Left section - Menu */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md text-white/60 hover:text-white hover:bg-white/[0.04]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Center section - BTC Price (mobile only) */}
      <div className="lg:hidden flex flex-col items-center">
        <span
          className="text-[7px] tracking-[0.2em] text-white/30 uppercase mb-0.5"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          in crypto we trust
        </span>
        {btcPrice && (
          <div className="flex items-center gap-1.5">
            <span className="text-orange-400 text-xs font-bold">₿</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={priceKey}
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 3 }}
                transition={{ duration: 0.15 }}
                className="text-xs font-mono text-white/90"
              >
                {formatPrice(btcPrice)}
              </motion.span>
            </AnimatePresence>
            <span
              className={`text-[9px] font-mono ${
                priceChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {priceChange >= 0 ? '↑' : '↓'}{Math.abs(priceChange).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Search - desktop only */}
      <div className="hidden lg:block flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-4 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md text-sm text-white placeholder-white/30 focus:border-white/20 transition-colors"
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="hidden sm:inline">SPEI conectado</span>
        <span className="sm:hidden">SPEI</span>
      </div>
    </header>
  );
}

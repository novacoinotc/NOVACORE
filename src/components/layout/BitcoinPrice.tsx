'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function BitcoinPrice() {
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      } catch (error) {
        console.error('Error fetching BTC price:', error);
        setLoading(false);
      }
    };

    fetchBtcPrice();
    const interval = setInterval(fetchBtcPrice, 30000);
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="fixed bottom-4 left-4 z-50"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/[0.08]">
        {/* Bitcoin Icon */}
        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
          <span className="text-orange-400 text-xs font-bold">₿</span>
        </div>

        <div className="flex flex-col">
          {loading ? (
            <span className="text-xs text-white/40">...</span>
          ) : btcPrice ? (
            <>
              <span className="text-sm font-mono text-white/90 leading-tight">
                {formatPrice(btcPrice)}
              </span>
              <span
                className={`text-[10px] font-mono leading-tight ${
                  priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-white/40">--</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

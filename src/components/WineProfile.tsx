import React from 'react';
import { WineMaster } from '../types';
import { motion } from 'motion/react';

interface WineProfileProps {
  wine: WineMaster;
  lang?: 'ja' | 'en';
}

export const WineProfile: React.FC<WineProfileProps> = ({ wine, lang = 'ja' }) => {
  const subjects = {
    ja: ['甘味', 'コク', '酸味', '渋み', '香りの豊かさ', '余韻の深さ'],
    en: ['Sweetness', 'Body', 'Acidity', 'Tannins', 'Aroma', 'Complexity']
  };

  const s = subjects[lang];

  // Geometrical Constants for absolute stability & 0ms load penalty
  const CX = 150;
  const CY = 140;
  const MAX_R = 85;

  // Safe Fallback Values (Defensive Coding)
  const values = [
    Number(wine.sweetness) || 1,
    Number(wine.body) || 3,
    Number(wine.acidity) || 3,
    Number(wine.tannins) || 3,
    Number(wine.aroma_intensity) || 3,
    Number(wine.complexity) || 3,
  ];

  // Map 1-5 scales safely to coordinates
  const getCoordinates = (index: number, value: number, radiusRatio = 1) => {
    const angle = -Math.PI / 2 + (index * Math.PI / 3);
    const r = (MAX_R * (Math.max(1, Math.min(5, value))) / 5) * radiusRatio;
    const x = CX + r * Math.cos(angle);
    const y = CY + r * Math.sin(angle);
    return { x, y };
  };

  // Generate radial grid paths
  const getGridPath = (level: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI / 3);
      const r = (MAX_R * level) / 5;
      const x = CX + r * Math.cos(angle);
      const y = CY + r * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return `M ${points.join(' L ')} Z`;
  };

  // Positional logic for smart label anchoring
  const getLabelPosition = (index: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI / 3);
    const r = MAX_R + 18;
    const x = CX + r * Math.cos(angle);
    const y = CY + r * Math.sin(angle);

    let textAnchor = 'middle';
    if (Math.cos(angle) > 0.15) textAnchor = 'start';
    else if (Math.cos(angle) < -0.15) textAnchor = 'end';

    let dy = '0.35em';
    if (Math.sin(angle) > 0.75) dy = '0.75em';
    else if (Math.sin(angle) < -0.75) dy = '-0.2em';

    return { x, y, textAnchor, dy };
  };

  const dataPoints = values.map((v, i) => {
    const { x, y } = getCoordinates(i, v);
    return `${x},${y}`;
  });
  const dataPath = `M ${dataPoints.join(' L ')} Z`;

  // Draw 6 spoke straight lines from origin to outermost grid vertices
  const spokes = Array.from({ length: 6 }).map((_, i) => {
    const outer = getCoordinates(i, 5);
    return { x1: CX, y1: CY, x2: outer.x, y2: outer.y };
  });

  return (
    <div id="radar-profile-failsafe" className="w-full h-72 flex justify-center items-center relative select-none">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 300 280"
        className="max-w-[340px] max-h-[280px]"
      >
        <defs>
          <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.75} />
            <stop offset="95%" stopColor="#C5A028" stopOpacity={0.25} />
          </linearGradient>
          <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1E1E1E" stopOpacity={0} />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.03} />
          </radialGradient>
        </defs>

        {/* Ambient Radial Fill */}
        <circle cx={CX} cy={CY} r={MAX_R} fill="url(#radarBg)" />

        {/* Concentric Hexagonal Grids */}
        {[1, 2, 3, 4, 5].map((level) => (
          <path
            key={`grid-${level}`}
            d={getGridPath(level)}
            fill="none"
            stroke="rgba(212,175,55,0.12)"
            strokeWidth={1}
            strokeDasharray={level === 5 ? 'none' : '2 2'}
          />
        ))}

        {/* Dynamic Spoke Lines */}
        {spokes.map((spoke, idx) => (
          <line
            key={`spoke-${idx}`}
            x1={spoke.x1}
            y1={spoke.y1}
            x2={spoke.x2}
            y2={spoke.y2}
            stroke="rgba(212,175,55,0.15)"
            strokeWidth={1}
          />
        ))}

        {/* Animated Main Data Polygon */}
        <motion.path
          d={dataPath}
          fill="url(#goldGradient)"
          stroke="#D4AF37"
          strokeWidth={1.8}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.25 }}
          style={{ originX: `${CX}px`, originY: `${CY}px` }}
        />

        {/* Dynamic Outer Dot Indicators for Interactive Polish */}
        {values.map((v, i) => {
          const { x, y } = getCoordinates(i, v);
          return (
            <motion.circle
              key={`dot-${i}`}
              cx={x}
              cy={y}
              r={3.5}
              fill="#D4AF37"
              stroke="#FFF"
              strokeWidth={1}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.05 }}
            />
          );
        })}

        {/* Smart Label Text Rendering */}
        {s.map((label, idx) => {
          const pos = getLabelPosition(idx);
          const score = values[idx];
          return (
            <g key={`lbl-group-${idx}`} className="font-sans">
              <text
                x={pos.x}
                y={pos.y}
                textAnchor={pos.textAnchor}
                dy={pos.dy}
                fill="#D4AF37"
                className="text-[10px] md:text-[11px] font-black uppercase tracking-wider"
              >
                {label}
              </text>
              {/* Optional tiny score helper badge */}
              <text
                x={pos.x}
                y={pos.y}
                textAnchor={pos.textAnchor}
                dy={pos.dy === '-0.2em' ? '0.85em' : '1.35em'}
                fill="rgba(212,175,55,0.6)"
                className="text-[8px] font-mono font-extrabold"
              >
                {score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

import React from 'react';
import { WineMaster } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface WineProfileProps {
  wine: WineMaster;
}

export const WineProfile: React.FC<WineProfileProps> = ({ wine }) => {
  const data = [
    { subject: '甘味', A: wine.sweetness || 1, fullMark: 5 },
    { subject: 'コク', A: wine.body || 3, fullMark: 5 },
    { subject: '酸味', A: wine.acidity || 3, fullMark: 5 },
    { subject: '渋み', A: wine.tannins || 3, fullMark: 5 },
    { subject: '香りの豊かさ', A: wine.aroma_intensity || 3, fullMark: 5 },
    { subject: '余韻の深さ', A: wine.complexity || 3, fullMark: 5 },
  ];

  return (
    <div className="w-full h-64 relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <defs>
            <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#C5A028" stopOpacity={0.3}/>
            </linearGradient>
          </defs>
          <PolarGrid stroke="rgba(212,175,55,0.1)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#D4AF37', fontSize: 12, fontWeight: 'bold' }} />
          <Radar
            name={wine.name_jp}
            dataKey="A"
            stroke="#D4AF37"
            fill="url(#goldGradient)"
            fillOpacity={1}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

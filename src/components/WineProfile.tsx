import React from 'react';
import { WineMaster } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface WineProfileProps {
  wine: WineMaster;
}

export const WineProfile: React.FC<WineProfileProps> = ({ wine }) => {
  const data = [
    { subject: '甘味', A: wine.sweetness || 1, fullMark: 5 },
    { subject: 'ボディ', A: wine.body, fullMark: 5 },
    { subject: '酸味', A: wine.acidity, fullMark: 5 },
    { subject: 'タンニン', A: wine.tannins, fullMark: 5 },
    { subject: '複雑さ', A: wine.complexity, fullMark: 5 },
    { subject: 'アロマ', A: wine.aroma_intensity, fullMark: 5 },
  ];

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#641E16', fontSize: 10 }} />
          <Radar
            name={wine.name_jp}
            dataKey="A"
            stroke="#D4AF37"
            fill="#D4AF37"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

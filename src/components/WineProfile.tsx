import React from 'react';
import { WineMaster } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface WineProfileProps {
  wine: WineMaster;
  language?: 'jp' | 'en';
}

export const WineProfile: React.FC<WineProfileProps> = ({ wine, language = 'jp' }) => {
  const t = {
    jp: {
      sweetness: '甘味',
      body: 'コク',
      acidity: '酸味',
      tannins: '渋み',
      aroma: '香りの豊かさ',
      complexity: '余韻の深さ'
    },
    en: {
      sweetness: 'Sweetness',
      body: 'Body',
      acidity: 'Acidity',
      tannins: 'Tannins',
      aroma: 'Aroma',
      complexity: 'Complexity'
    }
  };

  const data = [
    { subject: t[language].sweetness, A: wine.sweetness || 1, fullMark: 5 },
    { subject: t[language].body, A: wine.body || 3, fullMark: 5 },
    { subject: t[language].acidity, A: wine.acidity || 3, fullMark: 5 },
    { subject: t[language].tannins, A: wine.tannins || 3, fullMark: 5 },
    { subject: t[language].aroma, A: wine.aroma_intensity || 3, fullMark: 5 },
    { subject: t[language].complexity, A: wine.complexity || 3, fullMark: 5 },
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

import Papa from 'papaparse';
import { WineMaster } from '../types';

export const parseWineCSV = (file: File): Promise<WineMaster[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const decoders = [
        new TextDecoder('utf-8'),
        new TextDecoder('shift-jis')
      ];

      let resultsCsv = '';
      let usedSjis = false;

      // Try decoding with UTF-8 first
      try {
        const decoded = decoders[0].decode(buffer);
        if (decoded.includes('\ufffd') || decoded.includes('ｿ')) {
          resultsCsv = decoders[1].decode(buffer);
          usedSjis = true;
        } else {
          resultsCsv = decoded;
        }
      } catch (err) {
        resultsCsv = decoders[1].decode(buffer);
        usedSjis = true;
      }

      Papa.parse(resultsCsv, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          try {
            if (!results.data || results.data.length === 0) {
              throw new Error('CSVファイルにデータが見つかりません');
            }

            const importedWines: WineMaster[] = results.data.map((row: any) => {
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                const cleanKey = key.replace(/^\ufeff/, '').trim();
                normalizedRow[cleanKey] = row[key];
              });

              const getString = (keys: string[]) => {
                const key = keys.find(k => normalizedRow[k] !== undefined && normalizedRow[k] !== null);
                if (!key) return '';
                const val = normalizedRow[key];
                return String(val).trim();
              };
              const getNumber = (keys: string[]) => {
                const key = keys.find(k => normalizedRow[k] !== undefined && normalizedRow[k] !== null);
                if (!key) return 0;
                const val = normalizedRow[key];
                if (typeof val === 'number') return val;
                const strVal = String(val).replace(/[^0-9.]/g, '');
                return parseFloat(strVal) || 0;
              };

              const getImageUrl = (keys: string[]) => {
                const url = getString(keys);
                if (!url) return '';
                // If it's just an alphanumeric string of length 33 (likely a Drive ID)
                if (/^[a-zA-Z0-9_-]{33}$/.test(url)) {
                  return `https://drive.google.com/uc?id=${url}`;
                }
                return url;
              };

              return {
                id: getString(['id', 'ID', '商品コード', 'コード']),
                name_jp: getString(['name_jp', '商品名', '名称']),
                name_en: getString(['name_en', 'Name En', 'English Name']),
                country: getString(['country', '国', 'country_jp']),
                country_en: getString(['country_en', 'Country En']),
                region: getString(['region', '地域', 'region_jp']),
                region_en: getString(['region_en', 'Region En']),
                grape: getString(['grape', '品種', 'grape_jp']),
                grape_en: getString(['grape_en', 'Grape En']),
                color: getString(['color', '色']),
                color_en: getString(['color_en', 'Color En']),
                type: getString(['type', 'タイプ']),
                type_en: getString(['type_en', 'Type En']),
                vintage: getString(['vintage', 'ヴィンテージ']),
                alcohol: getString(['alcohol', 'アルコール']),
                price_bottle: getNumber(['price_bottle', '参考価格', 'ボトル価格']),
                price_glass: getNumber(['price_glass', 'グラス価格']),
                cost: getNumber(['cost', '仕入原価', 'コスト']),
                stock: getNumber(['stock', '在庫']),
                ideal_stock: getNumber(['ideal_stock', '適正在庫']),
                supplier: getString(['supplier', 'サプライヤー']),
                storage: getString(['storage', '保存場所']),
                storage_en: getString(['storage_en', 'Storage En']),
                ai_explanation: getString(['ai_explanation', 'AI解説', '解説']),
                ai_explanation_en: getString(['ai_explanation_en', 'AI Explanation En']),
                menu_short: getString(['menu_short', 'メニュー用略称']),
                menu_short_en: getString(['menu_short_en', 'Menu Short En']),
                pairing: getString(['pairing', 'ペアリング']),
                pairing_en: getString(['pairing_en', 'Pairing En']),
                sweetness: getNumber(['sweetness', '甘味', 'Sweetness']),
                body: getNumber(['body', 'ボディ', 'Body']),
                acidity: getNumber(['acidity', '酸味', 'Acidity']),
                tannins: getNumber(['tannins', 'タンニン', 'Tannins']),
                aroma_intensity: getNumber(['aroma_intensity', '香りの強さ', 'Aroma Intensity']),
                complexity: getNumber(['complexity', '複雑さ', 'Complexity']),
                finish: getNumber(['finish', '余韻', 'Finish']),
                oak: getNumber(['oak', '樽感', 'Oak']),
                aroma_features: getString(['aroma_features', '香りの特徴']),
                aroma_features_en: getString(['aroma_features_en', 'Aroma Features En']),
                tags: getString(['tags', 'タグ']),
                tags_en: getString(['tags_en', 'Tags En']),
                best_drinking: getString(['best_drinking', '飲み頃']),
                best_drinking_en: getString(['best_drinking_en', 'Best Drinking En']),
                image_url: getImageUrl(['image_url', '画像URL']),
                visible: normalizedRow.visible === 'ON' || normalizedRow.visible === true,
                glasses_per_bottle: getNumber(['glasses_per_bottle', '杯数']) || 6
              };
            }).filter(w => w.id !== '');

            resolve(importedWines);
          } catch (error: any) {
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    };
    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };
    reader.readAsArrayBuffer(file);
  });
};

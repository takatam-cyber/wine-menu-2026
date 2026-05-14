import React from 'react';
import { Store } from '../../types';
import { Key, Shield, Save, Loader2, UserPlus } from 'lucide-react';

interface OwnerAccountFormProps {
  selectedStore: Store | undefined;
  ownerEmail: string;
  setOwnerEmail: (email: string) => void;
  ownerPassword: string;
  setOwnerPassword: (password: string) => void;
  isCreatingOwner: boolean;
  isEditingOwner: boolean;
  onHandleCreateOwner: () => void;
  showOwnerForm: boolean;
  setShowOwnerForm: (show: boolean) => void;
  onToggleEditMode: () => void;
}

export const OwnerAccountForm: React.FC<OwnerAccountFormProps> = ({
  selectedStore,
  ownerEmail,
  setOwnerEmail,
  ownerPassword,
  setOwnerPassword,
  isCreatingOwner,
  isEditingOwner,
  onHandleCreateOwner,
  showOwnerForm,
  setShowOwnerForm,
  onToggleEditMode,
}) => {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Key className="text-brand-wine w-5 h-5" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">店舗統括アカウント</h2>
        </div>
        <button 
          onClick={onToggleEditMode}
          className="text-[10px] font-bold uppercase tracking-widest text-brand-wine hover:underline"
        >
          {showOwnerForm ? 'キャンセル' : (selectedStore?.ownerId ? '編集' : '新規登録')}
        </button>
      </div>

      {selectedStore?.ownerId && !showOwnerForm ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-brand-wine/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-brand-wine" />
            </div>
            <div>
              <p className="text-[10px] text-brand-wine font-bold uppercase tracking-widest">Active Store Admin</p>
              <p className="text-sm text-slate-700 font-bold">{selectedStore.owner_email}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed">このアカウントは店舗側のメニュー管理と在庫更新にのみアクセスが可能です。</p>
        </div>
      ) : showOwnerForm ? (
        <div className="space-y-6 animate-in slide-in-from-top duration-300">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">ログイン ID / メール</label>
              <input 
                type="text"
                placeholder="store_manager_id"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-brand-wine outline-none shadow-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                {isEditingOwner ? '新パスワード (変更時のみ)' : '初期パスワード'}
              </label>
              <input 
                type="password"
                placeholder={isEditingOwner ? '未入力なら維持' : '6文字以上'}
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:border-brand-wine outline-none shadow-sm"
              />
            </div>
            <button 
              onClick={onHandleCreateOwner}
              disabled={isCreatingOwner}
              className="w-full bg-brand-wine text-white py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg"
            >
              {isCreatingOwner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEditingOwner ? '情報を更新' : 'アカウントを発行'}
            </button>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
          <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-6 font-bold">オーナーアカウント未設定</p>
          <button 
            onClick={() => setShowOwnerForm(true)}
            className="mx-auto flex items-center gap-3 px-6 py-3 bg-white border-2 border-brand-wine text-brand-wine rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-wine hover:text-white transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            発行画面へ
          </button>
        </div>
      )}
    </div>
  );
};

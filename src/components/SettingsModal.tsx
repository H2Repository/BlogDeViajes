import React from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Sun, 
  Moon, 
  Monitor, 
  Check, 
  Database,
  Lock,
  UserCheck,
  Download,
  Code2,
  FileJson,
  Loader2
} from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { useAuth, ADMIN_EMAIL } from '../context/AuthContext';
import { FlutterIcon } from './FlutterIcon';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportData: () => void;
  onOpenFlutterCode: () => void;
  onDownloadFlutterZip: () => void;
  isDownloadingFlutter?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose,
  onExportData,
  onOpenFlutterCode,
  onDownloadFlutterZip,
  isDownloadingFlutter = false,
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { isAdmin, currentUser, openLoginModal, logout } = useAuth();

  if (!isOpen) return null;

  const themeOptions: { id: ThemeMode; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: 'system',
      label: '시스템',
      desc: '기기 OS의 다크/라이트 설정에 맞춥니다.',
      icon: Monitor,
    },
    {
      id: 'dark',
      label: '다크',
      desc: '어두운 테마로 눈의 피로를 줄여줍니다.',
      icon: Moon,
    },
    {
      id: 'light',
      label: '라이트',
      desc: '화사하고 밝은 클래식 테마입니다.',
      icon: Sun,
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col text-stone-900 dark:text-stone-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-stone-900 text-stone-100 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                설정
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                테마, 데이터 백업 및 모바일 소스 관리
              </p>
            </div>
          </div>

          <button
            id="btn-settings-close"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section: Theme */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                테마 설정
              </label>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                현재: {theme === 'system' ? `시스템 (${resolvedTheme === 'dark' ? '다크' : '라이트'})` : theme === 'dark' ? '다크 모드' : '라이트 모드'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {themeOptions.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    id={`btn-theme-${opt.id}`}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition cursor-pointer text-center relative ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                    <IconComponent className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500 dark:text-stone-400'}`} />
                    <span className="text-xs">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {theme === 'system' && '기기의 다크 모드/라이트 모드 전환에 실시간으로 자동 반응합니다.'}
              {theme === 'dark' && '배경을 어둡게 변경하여 야간 라이딩 기록 시 시각적 편안함을 제공합니다.'}
              {theme === 'light' && '선명하고 또렷한 클래식 라이트 화면으로 일기를 감상합니다.'}
            </p>
          </div>

          {/* Section: Data Backup & Export */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
              데이터 백업
            </label>
            <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <FileJson className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    일기 데이터 JSON 백업
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    전체 일기와 사진 데이터를 파일로 다운로드
                  </p>
                </div>
              </div>
              <button
                id="btn-settings-export-data"
                type="button"
                onClick={onExportData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-stone-900 dark:bg-stone-700 hover:bg-stone-800 dark:hover:bg-stone-600 text-white transition shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>내보내기</span>
              </button>
            </div>
          </div>

          {/* Section: Flutter Mobile App Source Code (Admin only) */}
          {isAdmin && (
            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                모바일 앱 소스 코드
              </label>
              <div className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-500 flex items-center justify-center">
                    <FlutterIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Flutter 크로스플랫폼 앱
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Android / iOS 용 모바일 앱 전체 프로젝트
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    id="btn-settings-download-flutter"
                    type="button"
                    onClick={onDownloadFlutterZip}
                    disabled={isDownloadingFlutter}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isDownloadingFlutter ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{isDownloadingFlutter ? 'ZIP 생성 중...' : 'ZIP 프로젝트 다운로드'}</span>
                  </button>
                  <button
                    id="btn-settings-view-flutter-code"
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFlutterCode();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border border-sky-300 dark:border-sky-700 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-800 dark:text-sky-300 transition cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>코드 보기</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section: Admin Status */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
              관리자 계정
            </label>
            <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isAdmin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-200 dark:bg-stone-700 text-stone-500'
                }`}>
                  {isAdmin ? <UserCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      {isAdmin ? 'Hill (관리자 인증됨)' : '일반 방문자 모드'}
                    </span>
                    {isAdmin && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 font-semibold">
                        관리자
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {ADMIN_EMAIL}
                  </p>
                </div>
              </div>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
                >
                  로그아웃
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openLoginModal();
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition cursor-pointer"
                >
                  로그인
                </button>
              )}
            </div>
          </div>

          {/* Section: Blog Info */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>데이터베이스</span>
              </span>
              <span className="font-medium text-stone-700 dark:text-stone-300">
                PostgreSQL & Firestore Dual-Sync
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
              <span>블로그 명</span>
              <span className="font-medium text-stone-700 dark:text-stone-300">
                Blog de viajes
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-800 hover:bg-stone-800 dark:hover:bg-stone-700 text-white text-xs font-bold transition cursor-pointer"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

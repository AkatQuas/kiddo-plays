import type { SettingStoreSchema } from '@shared/types/store';
import { SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Switch } from './ui/switch';

export function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const [proxyEnable, setProxyEnable] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyPort, setProxyPort] = useState('');

  useEffect(() => {
    if (isOpen) {
      window.App.invoke('settings.proxy').then((result) => {
        if (result.ok && result.data) {
          setProxyEnable(result.data.enable ?? false);
          setProxyUrl(result.data.url || '');
          setProxyPort(result.data.port || '');
        }
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const proxy: SettingStoreSchema['proxy'] = {
      enable: proxyEnable,
      url: proxyUrl,
      port: proxyPort,
    };
    const result = await window.App.invoke('settings.proxy.update', proxy);
    if (!result.ok) {
      toast.error(`代理设置失败：${result.error}`);
      return;
    }
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 p-2 transition-colors z-10"
        title="设置"
        type="button"
      >
        <SettingsIcon />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[360px]">
          <DialogHeader>
            <DialogTitle>设置</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 mb-2">代理设置</span>
              <Switch checked={proxyEnable} onCheckedChange={setProxyEnable} />
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="代理地址，例如: 127.0.0.1"
                className="w-full h-10 px-3 border border-border rounded-lg text-base bg-white text-gray-900 placeholder-gray-300 focus:border-brand-500 transition-colors"
              />
              <input
                type="text"
                value={proxyPort}
                onChange={(e) => setProxyPort(e.target.value)}
                placeholder="代理端口，例如: 7890"
                className="w-full h-10 px-3 border border-border rounded-lg text-base bg-white text-gray-900 placeholder-gray-300 focus:border-brand-500 transition-colors"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={!proxyUrl || !proxyPort}
                className="px-4 h-10 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

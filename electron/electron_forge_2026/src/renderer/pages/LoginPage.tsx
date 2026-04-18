import logoImage from '../assets/logo.png';
import { Settings } from '../components/Settings';

export function LoginPage() {
  return (
    <div
      className="h-screen flex flex-col"
      style={{
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Settings />

      {/* Login Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {/* Logo */}
        <div className="flex flex-col items-center mt-12 mb-6">
          <img src={logoImage} alt="Logo" className="w-16 h-16" />
          <span className="mt-3 text-[24px] font-semibold" style={{ color: '#161616' }}>
            Electron Forge 2026
          </span>
        </div>
      </div>
    </div>
  );
}

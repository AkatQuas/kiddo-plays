import { ConfigForm } from '../components/config/config_form';

export const Config = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your AI assistant</p>
        </header>

        <ConfigForm />
      </div>
    </div>
  );
};

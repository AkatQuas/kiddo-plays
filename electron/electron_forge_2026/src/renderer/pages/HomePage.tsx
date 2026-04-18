import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useAppStore } from '../store/appStore';

export function HomePage() {
  const { count, increment } = useAppStore();

  const handleLogout = async () => {
    await window.App.invoke('auth.logout');
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Welcome to React!</CardTitle>
          <CardDescription>Electron Forge + Vite + React + TypeScript</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Count: <span className="font-bold">{count}</span>
          </p>
          <div className="flex gap-2">
            <Button onClick={increment}>Increment</Button>
            <Button variant="outline" asChild>
              <Link to="/about">Go to About</Link>
            </Button>
          </div>
          <Button variant="destructive" onClick={handleLogout} className="w-full">
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

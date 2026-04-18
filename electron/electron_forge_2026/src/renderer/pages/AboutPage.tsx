import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function AboutPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This is a sample Electron app with React, React Router, Zustand, and shadcn/ui.
          </p>
          <Button variant="outline" asChild>
            <Link to="/">Go back Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

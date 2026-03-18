import { Link } from 'react-router-dom';
import { Button } from '../components/common/button';

export const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="text-8xl mb-4">404</div>
      <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/">Go Back Home</Link>
      </Button>
    </div>
  );
};

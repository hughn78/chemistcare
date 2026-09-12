import { useNavigate, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, RotateCw, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Real error view for a failed route.
 *
 * Previously the only errorElement in the app wrapped <NotFound />, so a route
 * exception rendered a 404 page and the user had no idea anything had failed —
 * and no way to retry. Stack traces are logged, never shown.
 */
export default function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const message =
    (isRouteErrorResponse(error) ? error.statusText : (error as Error)?.message) ||
    'An unexpected error occurred while loading this page.';

  // Logged for support; intentionally not rendered to the user.
  console.error('[RouteError]', error);

  const isNotFound = status === 404;

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div
            className="mx-auto w-12 h-12 rounded-full bg-clinical-danger-bg flex items-center justify-center"
            aria-hidden="true"
          >
            <AlertTriangle className="h-6 w-6" style={{ color: 'hsl(var(--clinical-danger))' }} />
          </div>

          <div>
            <h1 className="text-lg font-semibold">
              {isNotFound ? 'Page not found' : 'Something went wrong'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isNotFound
                ? 'The page you requested does not exist.'
                : 'This screen could not be displayed. Your work on other screens is unaffected.'}
            </p>
            {!isNotFound && (
              <p className="text-xs text-muted-foreground mt-2" role="status">
                {message}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
              <RotateCw className="h-4 w-4" />
              Try again
            </Button>
            <Button onClick={() => navigate('/dashboard')} className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Back to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useConfig } from '../../hooks/use_config';
import { Button } from '../common/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '../common/card';
import { Input } from '../common/input';
import { Textarea } from '../common/textarea';

export const ConfigForm = () => {
  const {
    register,
    handleSubmit,
    handleReset,
    errors,
    isValid,
    isLoading,
    baseURLIsValid,
    temperature
  } = useConfig();

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>LLM Configuration</CardTitle>
        <CardDescription>
          Configure your LLM provider and API key to start chatting
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* API Key */}
          <div>
            <label className="text-sm font-medium mb-1 block">API Key</label>
            <Input
              type="password"
              placeholder="sk-..."
              {...register('apiKey')}
              error={errors.apiKey?.message}
              disabled={isLoading}
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              API Base URL
            </label>
            <Input
              type="url"
              placeholder="https://api.example.com/v1/chat/completions"
              {...register('baseUrl')}
              error={errors.baseUrl?.message}
              disabled={isLoading}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Custom API endpoint (must support OpenAI-style chat completions)
            </p>
          </div>

          {/* model */}
          <div>
            <label className="text-sm font-medium mb-1 block">Model</label>
            <Input
              {...register('model')}
              error={errors.model?.message}
              disabled={isLoading}
            />
          </div>
          {/* System Prompt */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              System Prompt
            </label>
            <Textarea
              placeholder="You are a helpful assistant..."
              {...register('systemPrompt')}
              error={errors.systemPrompt?.message}
              disabled={isLoading}
              rows={4}
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              Temperature ({temperature})
            </label>
            <Input
              type="range"
              min="0"
              max="1"
              step="0.1"
              {...register('temperature', {
                valueAsNumber: true
              })}
              disabled={isLoading}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={handleReset}
            disabled={isLoading}
          >
            Reset to Default
          </Button>

          <Button
            type="submit"
            disabled={!isValid || isLoading || !baseURLIsValid}
          >
            {isLoading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

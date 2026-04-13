import { Vortex } from '../components/ui/vortex'

export const TestScreen = () => {
  return (
    <main className="flex flex-col items-center gap-5 mt-1">
      <h1 className="text-3xl font-bold">Test Screen</h1>
      <p className="text-muted-foreground">
        Environment: {import.meta.env.DEV ? 'Development' : 'Production'}
      </p>

      <div className="fixed left-0 -top-50 size-full -z-10 overflow-hidden">
        <Vortex
          backgroundColor="transparent"
          baseHue={50}
          baseRadius={2}
          className="flex size-full"
          particleCount={20}
          rangeSpeed={1.5}
          rangeY={300}
        />
      </div>
    </main>
  )
}

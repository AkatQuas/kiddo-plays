import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

interface Position {
  x: number
  y: number
}

function useDraggable() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef<Position>({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag if clicking on buttons
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x
      const newY = e.clientY - dragOffset.current.y
      const newPos = { x: Math.max(0, newX), y: Math.max(0, newY) }
      setPosition(newPos)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return { position, isDragging, handleMouseDown, containerRef }
}

export function PanelScreen() {
  const [isMaximized, setIsMaximized] = useState(true)
  const { position, handleMouseDown, containerRef } = useDraggable()

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: temporary
    <div
      className="absolute cursor-move select-none"
      onMouseDown={handleMouseDown}
      ref={containerRef}
      style={{
        left: position.x,
        top: position.y,
        zIndex: 9999,
      }}
    >
      <Card
        className={`w-80 overflow-hidden border-border/50 bg-background/95 shadow-2xl backdrop-blur-sm transition-all duration-300 ${
          isMaximized ? 'h-80' : 'h-12'
        }`}
      >
        {/* Card Header - draggable area */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Lite Mode</span>
          <div className="flex items-center gap-1">
            <Button
              className="size-6 p-0"
              onClick={() => setIsMaximized(!isMaximized)}
              size="icon-xs"
              variant="ghost"
            >
              {isMaximized ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronDown className="size-3 rotate-180" />
              )}
            </Button>
          </div>
        </div>

        {/* Card Content */}
        {isMaximized && (
          <div className="p-2">
            <p className="text-sm text-muted-foreground">Coming soon...</p>
          </div>
        )}
      </Card>
    </div>
  )
}
